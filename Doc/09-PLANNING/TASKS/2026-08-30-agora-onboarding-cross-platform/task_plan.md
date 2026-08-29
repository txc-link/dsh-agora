# Agora Onboarding Cross-Platform — Task Plan

**Date**: 2026-08-30
**Worktree**: `/home/ailink/dsh-agora/.worktrees/agora-onboarding-cross-platform`
**Branch**: `feat/agora-onboarding-cross-platform` (from master `1a5d6fc`)
**Owner**: 总工
**Goal**: 自动化 agora 安装 + 启动 + 配置 dashboard session auth (债 4 闭环), 跨 Linux systemd / macOS launchd / Windows sc / Docker / 裸 process

---

## §1 总工排期（4 轮独立 commit + merge）

| 轮 | 范围 | commit |
|---|---|---|
| **A.1** | `agora init --non-interactive` + `--admin-password-stdin` + `--skip-assets` + 11 tests | `fbbc99d` ✅ done |
| **A.2** | `agora serve` 跨5 平台 + `--print`/`--dry-run` + 8 tests + 不动现有 `agora start` dev helper | `3cd7b83` ✅ done |
| **A.3** | `Doc/scripts/install-agora.sh` 一键 wrapper + 文档 | ⏳ in_progress |
| **A.4** | 收口 (task_dir 三件套 + walkthrough + SSoT + 删 worktree) | pending |

---

## §2 债 4 真实根因（再次验证）

`agora init` CLI **已经设计完整 dashboard session auth onboarding flow**:
- CLI 询问 admin username/password
- 写到 `~/.agora/agora.json` (`dashboard_auth.enabled: true, method: 'session'`)
- `humanAccountService.bootstrapAdmin()` 创建 admin user
- server 启动时 `HumanAccountService.authenticate()` 验证 session 登录

**3 个实际阻塞债 4 自动化的 gap**:

| Gap | 当前 | 本轮修复 |
|---|---|---|
| **G1: init 命令是 interactive** | `@inquirer/prompts` 阻塞 stdin | `--non-interactive --admin-username=... --admin-password=...` |
| **G2: 写 `~/.agora/` 是 EROFS** | init 内部 `ensureBundledAgoraAssetsInstalled` 强制 install assets | `--skip-assets` flag |
| **G3: 没有 "agora serve" 跨平台入口** | 假设 systemd | 新增 `agora serve` 命令, 5 平台支持 |

---

## §3 修复方案

### 3.1 A.1 init non-interactive mode
**改动**:
- `agora-ts/apps/cli/src/init-command.ts`: 接口加 `nonInteractive / skipAssets / adminUsername / adminPassword / imProvider / discord` 字段; 新增 `runNonInteractiveInit()` 函数, 复用 `saveGlobalConfig` + `humanAccountService.bootstrapAdmin` + `bindIdentity` 现有流程
- `agora-ts/apps/cli/src/init-command.test.ts`: 加 6 个 test cases (3 validation + 3 happy path + skipAssets)
- `agora-ts/apps/cli/src/index.ts`: `init` command 加 commander options (`--non-interactive` / `--admin-username` / `--admin-password` / `--admin-password-stdin` / `--im` / `--discord-*` / `--skip-assets`)

**verify**: 11/11 tests pass, npm run build 0 errors

### 3.2 A.2 `agora serve` 跨平台
**改动**:
- `agora-ts/apps/cli/src/serve-command.ts`: 新文件, `detectPlatform()` (linux→systemd / darwin→launchd / win32→windows / else→bare) + 5 个 `renderDescriptor()` 函数 + 5 个 `startPlatformService()` 函数
- `agora-ts/apps/cli/src/serve-command.test.ts`: 8 cases (detect + 5 platform render + printOnly + extra env propagation)
- `agora-ts/apps/cli/src/index.ts`: 新增 `serve` command + 13 options (platform/port/host/user/unit-name/.../no-enable/dry-run/print)

**关键设计**:
- **不破坏现有 `agora start`** (dev helper, 跑 scripts/dev-start.sh)
- **`agora serve` 是 OS service install** (写 systemd unit / launchd plist / Windows service wrapper / docker-compose stack / nohup launcher)
- **每个平台一个 render + start function** — 没有兼容层 (§1.5)
- **`--print` / `--dry-run`** — 不实际执行 platform 命令, 只生成 descriptor 用于 review

**verify**: 8/8 tests pass, npm run build 0 errors, init+serve+start 三套测试 26/26 pass

### 3.3 A.3 wrapper script
**改动**:
- `Doc/scripts/install-agora.sh`: 7.2 KB bash script
  - 接受 `--admin-password` / `--admin-password-stdin` / `--platform` / `--port` / `--host` 等
  - 自动 detect OS → platform
  - 调 `agora init --non-interactive --skip-assets` (CI 友好)
  - 调 `agora serve --platform=$detected` (安装 OS service)
  - 回显 `listen URL / admin user / dashboard` 等摘要
  - 完整 `set -euo pipefail` + 错误处理

**关键设计**:
- **不是 `agora` CLI 的扩展**, 是**调用 CLI 的 bash 胶水**
- `--init-only` / `--serve-only` 支持**只跑其中一段** (已有 init 不想重复)
- `--agora-bin <path>` 支持自定义 CLI 路径 (dev 用)

**verify**: bash syntax OK, --help 输出正常, Linux platform 检测正常

---

## §4 Files Changed (cumulative)

| 轮 | File | 改动 |
|---|---|---|
| A.1 | `agora-ts/apps/cli/src/index.ts` | +49 / -4 (init options) |
| A.1 | `agora-ts/apps/cli/src/init-command.ts` | +119 (non-interactive 分支) |
| A.1 | `agora-ts/apps/cli/src/init-command.test.ts` | +128 (6 test cases) |
| A.2 | `agora-ts/apps/cli/src/index.ts` | +93 / -12 (serve command 注册) |
| A.2 | `agora-ts/apps/cli/src/serve-command.ts` | +386 (new) |
| A.2 | `agora-ts/apps/cli/src/serve-command.test.ts` | +131 (8 test cases) |
| A.3 | `Doc/scripts/install-agora.sh` | +250 (new wrapper) |

3 src commits + 1 wrapper = 4 commits, total ~1100 lines

---

## §5 §1.5 守约评估

| 维度 | 守约 |
|---|---|
| 不允许兜底 | ✅ 每平台 native service manager, 没有兼容层 |
| 不允许过度设计 | ✅ 没抽象 `IServiceManager` interface (一个文件多 if-else) |
| 不允许扩展到用户未要求的方案范围 | ✅ 只解决 install / start / 配 dashboard auth, 不动其他 |
| 必须保证方案逻辑自洽 | ✅ CLI command 一致命名 (init / serve / start 语义清晰区分); wrapper 是 bash 胶水 |

---

## §6 Cross-references

- **task_dir findings.md**: 详细侦察 + 与老 `agora start` 命令的边界
- **task_dir progress.md**: 步骤 checkbox + 实测验证
- **Doc/10-WALKTHROUGH/2026-08-30-agora-onboarding-cross-platform.md**: 待 commit
- **Doc/Agora-实施排期-Agora-TS.md** (SSoT): 收口时加 row 5 status