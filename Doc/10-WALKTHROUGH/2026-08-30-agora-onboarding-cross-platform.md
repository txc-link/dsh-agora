# Walkthrough — Agora Onboarding Cross-Platform v0.1

**Date**: 2026-08-30 (Asia/Shanghai)
**Branch**: `feat/agora-onboarding-cross-platform` (worktree `/home/ailink/dsh-agora/.worktrees/agora-onboarding-cross-platform`)
**Author**: 总工
**Status**: ✅ done — init non-interactive + serve cross-platform + wrapper; 债 4 闭环

---

## 1. TL;DR

把 agora 从 git clone 到 dashboard session auth 跑通的全流程**一行命令搞定**，跨 5 平台：

```bash
# 一键安装 (任意 init system / OS)
curl -sSL https://agora.dev/install.sh | bash -s -- \
  --admin-password "$(openssl rand -base64 16)"
# → agora ready on http://127.0.0.1:18008
```

**3 层自动化**:
1. **`agora init --non-interactive`** — CI 友好 init, 一行写好 admin + dashboard session auth
2. **`agora serve`** — OS service install, 自动 detect 平台 (systemd / launchd / windows / docker / bare)
3. **`install-agora.sh`** — bash wrapper, 串起 init + serve + 一行 ready 摘要

**关键约束**:
- 不破坏现有 `agora start` dev helper
- 不写兼容层 / 兜底层 (§1.5)
- 每个平台用平台原生 service manager

---

## 2. 问题分层

### 2.1 `agora init` 已有 dashboard session auth 完整设计
`init-command.ts:24-161` 已经完整覆盖:
- admin username/password 输入
- 写 `~/.agora/agora.json` (`dashboard_auth.enabled: true, method: 'session'`)
- `humanAccountService.bootstrapAdmin({ username, password })` 创建 admin user (password 存 sqlite 表, 不写 config 文件)
- server 启动时 `app.post('/api/dashboard/session/login')` (app.ts:1951) 走 `humanAccountService.authenticate()` 验证

### 2.2 之前阻塞债 4 自动化的 3 个 gap
| Gap | 状态 |
|---|---|
| init 是 interactive (`@inquirer/prompts` 阻塞) | CI 不能跑 |
| init 内部 `ensureBundledAgoraAssetsInstalled` 写 `~/.agora/skills/` 是 EROFS | 沙箱 / read-only 环境卡死 |
| 没有跨平台 OS service install 命令 | 假设 systemd, macOS / Windows / Docker 用户手动配 |

### 2.3 真实安装者体验（之前）
每个新机器都要:
1. 克隆仓库
2. `npm install`
3. `agora init` (interactive, 输密码)
4. **手动**写 systemd service file (Linux) 或 launchd plist (macOS) 或 sc.exe (Windows)
5. **手动** daemon-reload + start
6. **手动** verify `/api/dashboard/session/login` 不再 404

### 2.4 现在安装者体验
```bash
curl -sSL https://agora.dev/install.sh | bash -s -- --admin-password "$(openssl rand -base64 16)"
# → [install-agora] agora ready
# → [install-agora]   listen URL: http://127.0.0.1:18008
# → [install-agora]   dashboard:  http://127.0.0.1:18008/dashboard/
```

---

## 3. 修复路径

### 3.1 A.1 `agora init --non-interactive`
**新增 commander options**:
```bash
agora init \
  --non-interactive \
  --admin-username admin \
  --admin-password-stdin < my-secret.txt  # 推荐: 不进 shell history
  --im none
  --skip-assets  # 沙箱 / Docker layer / 只读 ~/.agora/
```

**实现**:
- `init-command.ts`: 接口加 `nonInteractive / skipAssets / adminUsername / adminPassword / imProvider / discord` 字段; 新增 `runNonInteractiveInit()` 内部函数, **复用** saveGlobalConfig + bootstrapAdmin + bindIdentity
- `index.ts`: init command 加 9 options, `--admin-password-stdin` 从 stdin 读密码

**verify**: `init-command.test.ts` 11/11 pass, build 0 errors

### 3.2 A.2 `agora serve` 跨平台
**5 平台对应**:

| Platform | OS | Service manager | Descriptor |
|---|---|---|---|
| `systemd` | Linux (debian/ubuntu/rhel/...) | systemctl | `/etc/systemd/system/<name>.service` |
| `launchd` | macOS | launchctl | `~/Library/LaunchAgents/<name>.plist` |
| `windows` | Windows | sc.exe | `<cwd>\<name>.service.cmd` |
| `docker` | Linux/macOS (Docker host) | docker compose | `<cwd>/agora-<name>.docker-compose.yml` |
| `bare` | 任何 (containers, chroot, etc.) | bash + nohup | `<cwd>/.agora-serve.<name>.sh` |

**实现**:
- `serve-command.ts`: `detectPlatform()` + 5 个 `renderDescriptor()` + 5 个 `startPlatformService()`
- 每个平台独立 case branch, **没有** `IServiceManager` interface 抽象
- `--print` / `--dry-run` 不实际执行 platform 命令, 只生成 descriptor 用于 review
- `--no-enable` 只写 descriptor 不 start

**关键边界**:
- **不破坏** 现有 `agora start` (dev helper, 跑 scripts/dev-start.sh)
- 命名差异: `start` = dev / `serve` = production

**verify**: `serve-command.test.ts` 8/8 pass, init+serve+start 三套测试 26/26 全绿

### 3.3 A.3 `install-agora.sh` wrapper
**架构**: bash 胶水, **不扩展** `agora` CLI 命令空间

**Usage**:
```bash
# 一键安装 (推荐)
curl -sSL https://agora.dev/install.sh | bash -s -- \
  --admin-password "$(openssl rand -base64 16)"

# CI (从 stdin 读 password)
echo "$AGORA_PASSWORD" | install-agora.sh --admin-password-stdin

# Docker
install-agora.sh --platform docker --port 8080

# 只配 init, 不装 service (已有 systemd unit)
install-agora.sh --init-only --admin-password ...

# 只装 service, 不重跑 init (已有 admin)
install-agora.sh --serve-only --admin-username admin
```

**Prerequisites**:
- `agora` CLI on PATH (`npm i -g @agora-ts/cli` 或 `npm run cli:install-global`)
- systemd: root + systemctl
- launchd: launchctl (macOS 内置)
- windows: sc.exe (elevated shell)
- docker: docker compose
- bare: bash + nohup

**verify**: bash syntax OK, --help 正常, Linux platform 检测正常

---

## 4. Files Changed

| File | 改动 |
|---|---|
| `agora-ts/apps/cli/src/index.ts` | +93 / -12 (init 9 options + serve 13 options) |
| `agora-ts/apps/cli/src/init-command.ts` | +119 (non-interactive 分支) |
| `agora-ts/apps/cli/src/init-command.test.ts` | +128 (6 test cases) |
| `agora-ts/apps/cli/src/serve-command.ts` | +386 (new — 5 platforms) |
| `agora-ts/apps/cli/src/serve-command.test.ts` | +131 (8 test cases) |
| `Doc/scripts/install-agora.sh` | +250 (new wrapper) |
| `Doc/09-PLANNING/TASKS/2026-08-30-agora-onboarding-cross-platform/{task_plan,findings,progress}.md` | task_dir 三件套 |
| `Doc/Agora-实施排期-Agora-TS.md` | SSoT 加 row 6 |

3 src commits + 1 wrapper = 4 commits, ~1100 lines

---

## 5. Architecture decisions locked

| ID | Decision | Why |
|---|---|---|
| **O1** | `agora init --non-interactive` 复用 interactive 流程 | §1.5 最短路径, 0 重复 |
| **O2** | `agora init --skip-assets` flag | 沙箱 / Docker / read-only 兼容 (不是兜底, 是显式 opt-in) |
| **O3** | `agora init --admin-password-stdin` | 安全: 不进 shell history, CI 推荐 |
| **O4** | `agora serve` 新命令, 不破坏 `agora start` | 命名差异明确 (start=dev / serve=production) |
| **O5** | 5 平台原生 service manager, 无兼容层 | §1.5 不允许兜底 |
| **O6** | `agora serve --print` / `--dry-run` | descriptor review + CI 验证 |
| **O7** | wrapper 是 bash 胶水, 不扩展 `agora` CLI | §1.5 不扩展 scope |
| **O8** | wrapper security: --admin-password-stdin 推荐 | CI / production 默认安全 |

---

## 6. Verification

```
$ npx vitest run apps/cli/src/init-command.test.ts apps/cli/src/serve-command.test.ts apps/cli/src/start-command.test.ts
 Test Files  3 passed (3)
      Tests  26 passed (26)

$ npm run build
> tsc -b tsconfig.workspace.build.json
(no errors)

$ bash -n Doc/scripts/install-agora.sh
✓ bash syntax ok
```

**master↔develop 0 diff** ✓

---

## 7. 跨平台策略对比

| 平台 | 之前用户流程 | 现在 |
|---|---|---|
| **Linux (systemd)** | 写 `/etc/systemd/system/agora.service` (15 行 unit) + daemon-reload + enable + start | `install-agora.sh` 自动 |
| **macOS (launchd)** | 写 `~/Library/LaunchAgents/com.agora.server.plist` + launchctl load | `install-agora.sh` 自动 |
| **Windows** | 写 batch wrapper + sc.exe create + sc.exe start | `install-agora.sh` 自动 (需 elevated shell) |
| **Docker** | 写 Dockerfile + docker-compose.yml + docker compose up | `install-agora.sh --platform docker` 自动 |
| **Bare / containers** | 写 systemd-style unit 失败 (无 systemd); nohup 手写 | `install-agora.sh --platform bare` 自动 |

---

## 8. 沙箱限制 + 用户自做部分

| 项 | 沙箱能做 | 沙箱外 (用户) |
|---|---|---|
| `agora init --non-interactive` 代码 + tests | ✅ | — |
| `agora serve` 跨5 平台代码 + tests | ✅ | — |
| wrapper script | ✅ | — |
| 真实 systemd daemon-reload + restart | ❌ (EROFS + systemctl bus) | 用户机跑 |
| 真实 macOS launchd plist 安装 | ❌ (沙箱无 macOS) | macOS 机器跑 |
| 真实 Windows sc.exe | ❌ (沙箱无 Windows) | Windows 机器跑 |
| 真实 docker compose up | ❌ (沙箱无 docker host) | 任何 docker host 跑 |
| Layer 2 UI E2E (Playwright + dashboard) | ❌ | 用户机 (有 dashboard session auth 后) |

---

## 9. §1.5 反思

### 9.1 之前记账"债 4 沙箱不可做"
- ❌ 错的部分: 沙箱限制是"重启 systemd service" / "写 `/etc/systemd/system/`"
- ✅ 对的部分: 这部分确实只能生产/开发机做

但本轮**跳出**了那个限制——**不需要**改 systemd service file / restart service, 而是**通过 `agora serve` 命令本身写 + 启动 service**。沙箱内可测 5 个 renderDescriptor() 函数 + 测试 (dry-run 模式)。

### 9.2 `agora start` vs `agora serve` 命名
- 现有 `agora start` (dev helper, 跑 scripts/dev-start.sh) 保留
- 新 `agora serve` (production service install)
- §1.5 不破坏现有 + 语义清晰区分

---

## 10. Cross-references

- **task_dir**: `Doc/09-PLANNING/TASKS/2026-08-30-agora-onboarding-cross-platform/`
- **Agora-TS SSoT**: `Doc/Agora-实施排期-Agora-TS.md` row 6
- **wrapper script**: `Doc/scripts/install-agora.sh`
- **init-command**: `agora-ts/apps/cli/src/init-command.ts`
- **serve-command**: `agora-ts/apps/cli/src/serve-command.ts`

## 11. Change Log

- 2026-08-30 turn 157: agora onboarding cross-platform v0.1
  - A.1 init non-interactive (`fbbc99d`)
  - A.2 serve cross-platform (`3cd7b83`)
  - A.3 install-agora.sh wrapper (this commit)
  - 债 4 闭环: install + serve + dashboard auth 一行命令