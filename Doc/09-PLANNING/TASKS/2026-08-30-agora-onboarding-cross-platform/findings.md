# Agora Onboarding Cross-Platform — Findings

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/agora-onboarding-cross-platform`

---

## §1 债 4 真实根因 (turn 154 验证)

### §1.1 `agora init` 已设计完整 dashboard session auth
init-command.ts:24-161 完整流程:
- admin username/password 输入
- 写 `~/.agora/agora.json` (`dashboard_auth.enabled: true, method: 'session'`)
- `humanAccountService.bootstrapAdmin({ username, password })` 创建 admin user
- server 启动时 `app.post('/api/dashboard/session/login')` (app.ts:1951) 走 `humanAccountService.authenticate(payload.username, payload.password)` 验证
- 完整 happy path 已存在, **不需要新设计 server 端**

### §1.2 init 写 password 到哪?
init-command.ts:82 + 141 调 `humanAccountService.bootstrapAdmin({ username, adminPassword })`, password **不写到 `~/.agora/agora.json`** (config 里只有 enabled/method/allowed_users/session_ttl_hours, 无 password)。

server runtime.ts 之前 turn 154 看到:
```ts
dashboardAuth: {
  enabled: config.dashboard_auth.enabled,
  method: config.dashboard_auth.method,
  allowedUsers: config.dashboard_auth.allowed_users,
  password: process.env.AGORA_DASHBOARD_BASIC_PASSWORD ?? null,  // env var, 不是 config
  sessionTtlHours: config.dashboard_auth.session_ttl_hours,
},
```

**结论**:
- `agora init` **首选**走 `humanAccountService` (sqlite 表存 password hash) — 已设计完整
- `dashboardAuth.password` env var 仅当 init 没跑过 / humanAccountService 不可用时的 **fallback**

意思是 **债 4 真正状态** = init command **已经能配 session auth 通过 HumanAccountService**, **完全不需要 env var**! 但 init 是 interactive, **沙箱不能跑**, EROFS 限制 `ensureBundledAgoraAssetsInstalled`。

### §1.3 3 个 gap (本轮修复)

| Gap | 修复 |
|---|---|
| G1: init 是 interactive (inquirer 阻塞) | A.1 `--non-interactive --admin-*` flags |
| G2: init 写 `~/.agora/` 是 EROFS | A.1 `--skip-assets` flag (跳过 ensureBundledAgoraAssetsInstalled) |
| G3: 没有跨平台 "agora serve" OS service install | A.2 新增 `agora serve` 命令 (systemd / launchd / windows / docker / bare) |

---

## §2 A.1 init non-interactive 关键决策

### §2.1 接口扩展 vs 新增函数
选 **接口扩展** (`RunInitCommandOptions` 加字段 + 新增 `runNonInteractiveInit()` 内部函数) 而非 **完全独立** 函数:
- ✅ 复用现有 `saveGlobalConfig` / `humanAccountService.bootstrapAdmin` / `bindIdentity` 逻辑
- ✅ interactive 流程零改动
- ✅ 同一入口 `runInitCommand` 根据 `nonInteractive` flag 派发

### §2.2 字段命名
- `--admin-username` / `--admin-password` — 与 existing init `input` 字段名一致
- `--admin-password-stdin` — 避免 shell history 暴露 (CI / production 推荐)
- `--im` (none|discord) — 与现有 `select` 选项一致
- `--skip-assets` — 沙箱 / Docker layer / 只读 `~/.agora/` 时使用

### §2.3 exactOptionalPropertyTypes 兼容性
TS strict 模式 (`exactOptionalPropertyTypes: true`) 不允许 `undefined` 赋值给 optional 字段。**cli index.ts** 用 conditional spread (`...(x !== undefined ? { x } : {})`) 修 — 不污染 RunInitCommandOptions 接口签名 (§1.5 不兜底)

---

## §3 A.2 `agora serve` 跨平台关键决策

### §3.1 与现有 `agora start` 边界
- **现有 `agora start`** (start-command.ts): dev helper, 找 project root + 跑 `scripts/dev-start.sh` (本地开发)
- **新 `agora serve`**: production service install, 写 OS service descriptor

命名差异明确: `start` = 开发期 / `serve` = 生产期. **§1.5 不破坏现有** — start-command.ts 不动.

### §3.2 平台检测 + descriptor 渲染
- `detectPlatform()`: `linux→systemd / darwin→launchd / win32→windows / else→bare`
- 5 个 `renderDescriptor()`: 每个平台一个独立函数 (systemd unit / launchd plist / Windows cmd / docker-compose yml / bash script)
- 5 个 `startPlatformService()`: 每个平台独立执行 `systemctl daemon-reload + enable + start` / `launchctl load -w + start` / `sc create + start` / `docker compose up -d` / `bash <script>`
- 没有抽象 `IServiceManager` interface — 5 个 case branch 直接 (§1.5 最短路径)

### §3.3 launchd plist env 渲染
每个 env var 用 `<key>X</key><string>Y</string>` (不是 `<string>X</string>`). 修复测试断言反映实际格式.

### §3.4 Docker 镜像名
硬编码 `agora-ts:0.0.0` — 这是基础 image, build 时替换. 不抽象 (用户明确说要 Docker, 直接给具体配置).

---

## §4 A.3 wrapper 关键决策

### §4.1 wrapper 不扩展 agora CLI
- wrapper 是 **bash 胶水**, 调 `agora init --non-interactive` + `agora serve`
- 不污染 `agora` CLI 命令空间
- 跨平台 bash (Linux / macOS) 可用; Windows 通过 WSL / Git Bash
- `--agora-bin <path>` 支持自定义 CLI 路径 (dev / staging)

### §4.2 wrapper 安全考量
- `--admin-password` 直接 echo, **shell history 暴露** (warn 在 usage + comment)
- 推荐 `--admin-password-stdin` 或 `AGORA_ADMIN_PASSWORD` env var
- wrapper 自身**不 echo** admin password, 只 echo listen URL + admin username

### §4.3 wrapper 错误处理
- `set -euo pipefail` (任何 subcommand 失败立即 fail)
- `fail()` helper 统一错误输出 + exit code
- 缺 `--admin-password` (非 serve-only) → exit 1
- `--init-only` + `--serve-only` 互斥 → exit 1

---

## §5 与债链的关系

| 时代 | 债 | 本轮影响 |
|---|---|---|
| **R-baseline cleanup (turn 152)** | 债 1 typedrift — worktree-local dist 修 | 暴露债 5 (worktree-local dist 手工) |
| **R-vitest cleanup (turn 153)** | 债 2 vitest — fixture 同步 | 同样暴露债 5 |
| **R-contracts dist onboarding (turn 155)** | 债 5 onboarding 自动化 | 闭环 |
| **R-onboarding cross-platform (本轮 turn 157)** | 债 4 install/serve 自动化 | **本轮修复** |

---

## §6 Side effects / 未决

- ✅ **债 4 闭环**: install + serve + dashboard auth 全部一行命令完成
- ⚠️ **Layer 2 UI E2E 仍需生产/开发机** (沙箱 EROFS + systemctl bus 限制仍存在) — 但 init + serve 跑通后 Layer 2 e2e 验证可在 production-like 机器跑
- ⚠️ Wrapper script **没自动化测试** (bash script); 用 `--help` + syntax check 替代 — 沙箱不能跑完整 init/serve (EOFS)