#!/usr/bin/env bash
# scripts/deploy-b1-b3-to-this-host.sh
# 部署 B1 (agora-ts calendar wire) + B3 (connector /agora say) 到本机 host.
#
# 用法 (在 host shell 跑, 不是 bwrap sandbox 里):
#   bash /home/ailink/dsh-agora/scripts/deploy-b1-b3-to-this-host.sh
#
# 这个脚本会:
#   1. 拉 master HEAD (已经包含 B1+B3 代码)
#   2. 重新 build agora-ts/apps/server (因为 dist 是旧版本, 不含 B1 wire)
#   3. 加 RADICALE_URL/USER/PASSWORD env 到 systemd unit (B1 calendar 需要)
#   4. 重启 agora-ts.service
#   5. 验证 /api/calendar/today route 返回 503/400 而不是 404
#   6. (可选) 重启 dsh-matrix-connector.service (B3)

set -euo pipefail

REPO="/home/ailink/dsh-agora"
SYSTEMD_UNIT="/etc/systemd/system/agora.service"
RADICALE_PASSWORD="${RADICALE_PASSWORD:-secret}"   # 占位值, 生产请用 env 覆盖

echo "=== 1. git pull master ==="
cd "$REPO"
git fetch origin
git checkout master
git pull --ff-only origin master

echo ""
echo "=== 2. rebuild agora-ts server (B1 dist) ==="
cd "$REPO/agora-ts"
npm run build --workspace=@agora-ts/server

echo ""
echo "=== 3. add RADICALE env to systemd unit (idempotent) ==="
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
add_service_env RADICALE_URL "http://127.0.0.1:5232"
add_service_env RADICALE_USER "tester"
add_service_env RADICALE_PASSWORD "${RADICALE_PASSWORD}"

echo ""
echo "=== 4. daemon-reload + restart ==="
systemctl daemon-reload
[ -n "${SYSTEMD_UNIT:-}" ] || SYSTEMD_UNIT=/etc/systemd/system/agora.service
for key in RADICALE_URL RADICALE_USER RADICALE_PASSWORD; do
  systemctl show agora -p Environment --value | grep -q "${key}=" \
    || { echo "FATAL: ${key} 没进 systemd Environment — 检查 [Service] 段"; exit 1; }
done
systemctl restart agora.service
sleep 3

echo ""
echo "=== 5. verify ==="
echo "  /api/health:"
curl -s --max-time 5 http://127.0.0.1:18008/api/health || echo "  (failed)"
echo ""
echo "  /api/calendar/today (should be 503 or 400, NOT 404):"
curl -s -o /dev/null -w "  status: %{http_code}\n" --max-time 5 \
  -H "Authorization: Bearer test-token" \
  http://127.0.0.1:18008/api/calendar/today

echo ""
echo "=== 6. dsh-matrix-connector (B3) ==="
CONNECTOR_UNIT="/etc/systemd/system/dsh-matrix-connector.service"
if [ -f "$CONNECTOR_UNIT" ]; then
  systemctl restart dsh-matrix-connector.service
  sleep 2
  echo "  connector restarted"
else
  echo "  no systemd unit found at $CONNECTOR_UNIT — skip"
  echo "  (B3 deploy assumes connector runs as a foreground process elsewhere)"
fi

echo ""
echo "=== done ==="
echo "如果 /api/calendar/today 仍然返 404, 请检查 dist/index.js 是否含 readCalendarEnv:"
echo "  grep readCalendarEnv $REPO/agora-ts/apps/server/dist/runtime.js"
echo "如果返回空, build 没生效 — 手动:"
echo "  cd $REPO/agora-ts && rm -rf apps/server/dist && npm run build --workspace=@agora-ts/server"