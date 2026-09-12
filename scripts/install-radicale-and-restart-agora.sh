#!/usr/bin/env bash
# scripts/install-radicale-and-restart-agora.sh
# 在 host 跑 (不是 bwrap sandbox).
#
# 一次性脚本:
#   1. 拉 master HEAD (含 B1 wire + B3 connector)
#   2. 重新 build agora-ts/apps/server (含 readCalendarEnv + createCalendarServiceFromEnv)
#   3. 装 RADICALE (CalDAV server) - apt install radicale + users.conf + collections
#   4. 加 RADICALE_URL/USER/PASSWORD env 到 agora systemd unit
#   5. 重启 agora + radicale
#   6. 验证 /api/calendar/today 返 200 + JSON events (而不是 503/404)
#
# 注: 8080 fish-speech 没启, /agora say 仍不可用; 启 fish-speech 看 https://github.com/fisha-ai/fish-speech README.

set -euo pipefail

REPO="/home/ailink/dsh-agora"
SYSTEMD_UNIT="/etc/systemd/system/agora.service"
RADICALE_PORT=5232
RADICALE_USER=tester
RADICALE_PASSWORD=${RADICALE_PASSWORD:-secret}   # 占位值, 生产请用 env 覆盖

echo "============================================================"
echo "STEP 1: pull master HEAD"
echo "============================================================"
cd "$REPO"
git fetch origin
git checkout master
git pull --ff-only origin master
git log --oneline -3

echo ""
echo "============================================================"
echo "STEP 2: rebuild agora-ts server (B1 wire)"
echo "============================================================"
cd "$REPO/agora-ts"

# npm/pnpm workspace 软链可能缺失 (包是在最后一次 install 之后才加进来的),
# 症状是 tsc 报 TS2307 且 node 启动时直接 MODULE_NOT_FOUND. 缺哪个补哪个.
ensure_workspace_links() {
  local root="$REPO/agora-ts" scope dir name link
  for scope in packages apps; do
    for dir in "$root/$scope"/*; do
      [ -d "$dir" ] || continue
      name="$(basename "$dir")"
      link="$root/node_modules/@agora-ts/$name"
      if [ ! -e "$link" ]; then
        ln -s "../../$scope/$name" "$link"
        echo "  linked @agora-ts/$name -> $scope/$name"
      fi
    done
  done
}
ensure_workspace_links

rm -rf apps/server/dist
npm run build --workspace=@agora-ts/server

echo ""
echo "============================================================"
echo "STEP 3: install RADICALE"
echo "============================================================"
if ! command -v radicale >/dev/null 2>&1; then
  apt-get update
  apt-get install -y radicale
else
  echo "radicale already installed: $(radicale --version)"
fi

# 配置 RADICALE: 加 user + auth
mkdir -p /var/lib/radicale/collections
RADICALE_CONFIG=/etc/radicale/config
if [ ! -f "$RADICALE_CONFIG" ]; then
  cat > "$RADICALE_CONFIG" <<'EOF'
[auth]
type = htpasswd
htpasswd_filename = /etc/radicale/users
htpasswd_encryption = plain

[storage]
type = multifilesystem
filesystem_folder = /var/lib/radicale/collections

[rights]
type = owner_only

[server]
hosts = 127.0.0.1:5232
EOF
fi

# 加 tester user (cleartext)
HTPASSWD=/etc/radicale/users
if ! grep -q "^tester:" "$HTPASSWD" 2>/dev/null; then
  echo "tester:secret" >> "$HTPASSWD"
  chmod 640 "$HTPASSWD"
  chown radicale:radicale "$HTPASSWD" 2>/dev/null || true
fi

# 启动 radicale
systemctl enable radicale
systemctl restart radicale
sleep 2
echo "radicale health:"
curl -s -o /dev/null -w "  status: %{http_code}\n" --max-time 5 http://127.0.0.1:5232/ || echo "  (failed)"

# 集合必须是 MKCALENDAR 建出来的. 手写 .Radicale.props ({"tag":"VCALENDAR"})
# 不被 Radicale 认作日历集合 -> PUT 事件返回 409, adapter GET 拿到 404.
# 幂等: 已存在时 Radicale 返回 409/405, 这里只看是否可达.
for COL in work life; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -u "${RADICALE_USER}:${RADICALE_PASSWORD}" \
    -X MKCALENDAR "http://127.0.0.1:${RADICALE_PORT}/${RADICALE_USER}/${COL}/")
  echo "  collection ${RADICALE_USER}/${COL}: MKCALENDAR -> ${code}"
done

echo ""
echo "============================================================"
echo "STEP 4: add RADICALE env to agora systemd unit"
echo "============================================================"
# systemd 只在 [Service] 段里读 Environment=. 直接 append 到 unit 文件末尾会
# 落在 [Install] 之后 -> systemd 记 "Unknown key ... ignoring", 服务根本看不到变量.
add_service_env() {
  local key="$1" value="$2"
  if grep -q "^Environment=${key}=" "$SYSTEMD_UNIT" 2>/dev/null; then
    echo "  ${key} already present"
    return
  fi
  sed -i "/^\[Install\]/i Environment=${key}=${value}" "$SYSTEMD_UNIT"
  echo "  ${key} added to [Service]"
}

echo "  RADICALE env -> [Service]"
add_service_env RADICALE_URL "http://127.0.0.1:${RADICALE_PORT}"
add_service_env RADICALE_USER "${RADICALE_USER}"
add_service_env RADICALE_PASSWORD "${RADICALE_PASSWORD}"
# CalDAV 事件是 UTC; CalendarService 按 offset 把 "today" 折算到部署时区.
# 宿主是 CST 时若缺这一项, 00:00-08:00 的本地事件会被算进前一天.
add_service_env CALENDAR_TIMEZONE_OFFSET_MINUTES "${CALENDAR_TIMEZONE_OFFSET_MINUTES:-480}"

echo ""
echo "============================================================"
echo "STEP 5: restart agora"
echo "============================================================"
systemctl daemon-reload
[ -n "${SYSTEMD_UNIT:-}" ] || SYSTEMD_UNIT=/etc/systemd/system/agora.service
for key in RADICALE_URL RADICALE_USER RADICALE_PASSWORD CALENDAR_TIMEZONE_OFFSET_MINUTES; do
  systemctl show agora -p Environment --value | grep -q "${key}=" \
    || { echo "FATAL: ${key} 没进 systemd Environment — 检查 [Service] 段"; exit 1; }
done
systemctl restart agora.service
sleep 3

echo ""
echo "============================================================"
echo "STEP 6: verify B1 wire"
echo "============================================================"
echo "  /api/health:"
curl -s --max-time 5 http://127.0.0.1:18008/api/health
echo ""
# 读真实 apiToken (占位 test-token 会 401, 验不出东西)
TOKEN=$(grep -oP "apiToken: '\K[^']+" /home/ailink/.dsh/profiles/web/cordis.patch.yml 2>/dev/null | head -1 || true)
if [ -z "$TOKEN" ]; then
  echo "  WARN: 读不到 apiToken, 跳过 /api/calendar/today 的授权验证"
else
  echo "  /api/calendar/today (应该 200 + events[] , 不是 503/401):"
  body=$(curl -s -w "\nstatus: %{http_code}" --max-time 5 \
    -H "Authorization: Bearer ${TOKEN}" \
    http://127.0.0.1:18008/api/calendar/today)
  echo "$body" | sed 's/^/    /'
  echo "$body" | tail -1 | grep -q "status: 200" || { echo "FATAL: /api/calendar/today 没返 200"; exit 1; }
  echo "$body" | grep -q '"events"' || { echo "FATAL: 响应里没有 events 字段"; exit 1; }
fi

echo ""
echo "============================================================"
echo "STEP 7 (optional): dsh-matrix-connector (B3)"
echo "============================================================"
CONNECTOR_UNIT="/etc/systemd/system/dsh-matrix-connector.service"
if [ -f "$CONNECTOR_UNIT" ]; then
  systemctl restart dsh-matrix-connector.service
  echo "connector restarted"
else
  echo "no systemd unit found at $CONNECTOR_UNIT — skip"
fi

echo ""
echo "============================================================"
echo "DONE"
echo "============================================================"
echo "Live verification (从公网 8.136.15.147):"
echo "  curl http://8.136.15.147:18008/api/calendar/today -H 'Authorization: Bearer test'"
echo "应该返 200 + {events: []} (empty calendar for tester user)"