# npm publish checklist — dsh-matrix-connector 0.6.0

> **Status**: artifact ready, awaiting user `npm login` + 4 decisions.
> **Last refreshed**: 2026-09-01 (turn 9 step 9 — fresh `dsh-matrix-connector-0.6.0.tgz` 127 KB at `/home/ailink/`).

## A. 预决策 (用户拍 4 项才能 publish)

| # | 决策项 | 推荐默认值 | 备注 |
|---|---|---|---|
| 1 | npm registry | `https://registry.npmjs.org` (公共) | 沙箱默认是 `registry.npmmirror.com` (镜像)，需要 explicit override |
| 2 | npm tag | `next-batch` | 已有 0.5.2 在 `latest` 上，建议 `next-batch` 让 install 显式 opt-in |
| 3 | npm 2FA | `--otp=<code>` 用户手动提供 | `npm login` 后用 `npm profile get --otp=<code>` 验证 2FA |
| 4 | 发布时机 | 现在 / 等部署齐后 | 见 §C 部署依赖 |

## B. 执行命令（用户决定 §A 4 项后跑）

```bash
cd /home/ailink/dsh-matrix-connector

# 1. login（用户交互；输入 npmjs.org 用户名 + 密码 + email + 2FA）
npm login --registry=https://registry.npmjs.org

# 2. 验证登录 + 2FA
npm whoami --registry=https://registry.npmjs.org
npm profile get --otp=<code>

# 3. dry-run 一次（再次确认 0.6.0 tar 内容）
npm_config_cache=/tmp/dh-pack2 \
npm_config_registry=https://registry.npmjs.org \
  npm publish --access public --tag next-batch --dry-run

# 4. 真发布
npm_config_cache=/tmp/dh-pack2 \
npm_config_registry=https://registry.npmjs.org \
  npm publish --access public --tag next-batch --otp=<code>
```

如果切换到 `latest`：
```bash
npm publish --access public --tag latest --otp=<code>    # 替换 0.5.2
# 或
npm dist-tag add dsh-matrix-connector@0.6.0 latest --otp=<code>
```

## C. 部署依赖（用户决定 §A #4 时参考）

0.6.0 的 enablement（不是核心依赖）:
- FunASR STT (用户机运行, 默认 :18000) — connector 配置
- Fish Speech TTS (用户机运行, 默认 :8080) — connector 配置
- Radicale (用户机运行, 默认 :5232) — adapters-calendar
- monitoring-relay Node 服务（独立 systemd / docker）
- Grafana (已跑 :3001) + Matrix homeserver (已跑) — relay 投递

**核心 / REST 服务不需要等部署**：
- dsh-agora master 已 ready：`ae5ee63..daa60ef` (含 next-batch + handoff + hygiene)
- dsh-matrix-connector main 已 ready：`d33dd49` (含 next-batch + transfer placeholder)

所以推荐：现在发 0.6.0 (tag=next-batch)，部署完改 tag 到 latest。

## D. 回滚预案（万一 publish 错版本）

npm 允许 unpublish within 72 hours：
```bash
npm unpublish dsh-matrix-connector@0.6.0 --otp=<code>   # 72 小时内
# 或
npm deprecate dsh-matrix-connector@0.6.0 "wrong tag, use 0.6.1" --otp=<code>
```

> 注：超过 72 小时只能 deprecate，不能删版本号。

## E. 沙箱相关（agent 自己跑环境的注意事项）

沙箱 npm 默认：
- registry = `registry.npmmirror.com`
- cache = `/root/.npm` (EROFS 沙箱限制)

publish 需要：
```bash
npm_config_cache=<writable-dir> \         # e.g. /tmp/dh-pack2
npm_config_registry=https://registry.npmjs.org \
  npm ...
```

在用户主机上 `npm login` 后这两个变量都不用设（用户机通常是公共 registry + 用户家目录 npm cache）。

## F. 已完成准备

- ✅ dsh-matrix-connector 0.6.0 source 在 `main`（commit `d33dd49`）+ pushed to origin
- ✅ Tgz artifact：`/home/ailink/dsh-matrix-connector-0.6.0.tgz` (127 KB, mtime 2026-09-01)
- ✅ Tarball 内容（dry-run 已验证）：`+ dsh-matrix-connector@0.6.0`，含 lib/* (含 calendar/doc/call/say/transfer 等新 verb handler)
- ✅ tsc typecheck clean (288/288 tests passing)

等用户决定 §A 4 项后执行 §B。
