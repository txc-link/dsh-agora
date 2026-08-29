# Win(node-b) / Mac(node-c) 手动装机分步卡

- 日期: 2026-08-30 | 适用: 方案 C 拓扑, CORE = Linux 中央节点(8.136.15.147), 已 live
- 脚本来源: `.repos/dsh-matrix-connector/deploy/03-install-dsh-plugin.sh`（Linux 版）的手动等价翻译
- 凭据: `.repos/dsh-matrix-connector/deploy/node-b.env`（Win bot）/ `node-c.env`（Mac bot）; agora token = CORE `/root/.agora/api-token`

## 0) 准备（两台机相同）

1. 本机已装 DSH 且有 profile（下称 `web`）: `dsh --profile web --dump-config` 能输出即 OK
2. 拿到 connector 源码: `git clone` dsh-matrix-connector 到本机任意路径（下称 `<connector-src>`）
3. 取到本节点 bot 凭据 4 项（从对应 node-*.env）:
   - `MATRIX_USER_ID` / `MATRIX_ACCESS_TOKEN` / `MATRIX_DEVICE_ID`（homeserver 固定 `http://8.136.15.147:8008`）

## 1) 安装插件

- Windows PowerShell:
  ```powershell
  dsh plugin --profile web add <connector-src>
  ```
- macOS zsh:
  ```bash
  dsh plugin --profile web add <connector-src>
  ```

## 2) 追加 profile patch（`~/.dsh/profiles/web/cordis.patch.yml`）

把下面整块追加到文件末尾（`node-b` 换成 `node-c`、凭据换成 node-c.env 对应值 when Mac）:

```yaml
# ── dsh-matrix-connector (node: node-b) ─────────────────────────────
# 改配置后重启 dsh 生效。
- insert:
    - id: matrix-connector
      name: 'dsh-matrix-connector'
      config:
        homeserverUrl: 'http://8.136.15.147:8008'
        userId: '@dsh-bridge-node-b:agent-hub.local'
        accessToken: '<node-b MATRIX_ACCESS_TOKEN>'
        deviceId: '<node-b MATRIX_DEVICE_ID>'
        agoraServerUrl: 'http://8.136.15.147:18008'
        agoraApiToken: '<CORE /root/.agora/api-token 同值>'
        nodeId: 'node-b'
        commandName: 'agora'
        nodeEnabled: true
        shareSessionInChannel: false
        allowFrom: '*'
        autoJoin: true
        eventPollIntervalMs: 5000
        requestTimeoutMs: 10000
```

## 3) 校验 + 重启

```bash
dsh --profile web --dump-config | grep matrix-connector   # 有输出 = 配置进入
dsh --profile web                                          # 重启 DSH 生效
```

## 4) 告知 agent 回归

两台机都装完后告诉 agent「Win/Mac 已装」。agent 将在 CORE 侧跑三机 `04-verify.sh`:
- 每台 bot 能登录 homeserver、建房、收发
- plugin 经 agora REST 建任务/回报状态
- 组织房间三 bot 同时在线

## 常见问题

- `dump` 未见 matrix-connector → patch 文件 YAML 缩进（`- insert:` 下两级）或引号问题
- bot 登录失败 → token 是否整串复制（`syt_` 开头）、homeserver 是否 `http://`（CORE 未开 TLS）
- 房间没反应 → 组织房间邀请: 在 CORE 用 admin 把 `@dsh-bridge-node-b/c:agent-hub.local` 拉进房间 `!uFTXBPVMUCSBCakAxi:agent-hub.local`（agent 可代做）
