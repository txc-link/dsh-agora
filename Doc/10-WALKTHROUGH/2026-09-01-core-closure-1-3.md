# Core Closure 1–3 walkthrough

## 结果

本阶段把“任务可治理地派发 → 可观察地执行 → 可接管恢复 → 产出可审阅版本化”接成一条 provider-neutral 主链。没有修改 DSH provider 源码。

## 主要入口

- `GET /api/tasks/:taskId/timeline?stuck_after_ms=900000`
- `POST /api/tasks/:taskId/claims/takeover`，body: `{ "agent_ref": "...", "reason": "...", "ttl_ms": 3600000 }`
- `GET /api/tasks/:taskId/artifacts`
- `GET /api/artifacts/:artifactId/versions`
- `POST /api/artifacts/:artifactId/review`
- CLI: `agora claim takeover --task <id> --agent <ref>`

协调运行若 metadata 带 `collaboration_plan_id`，会自动生成 governed dispatch envelope；server/CLI 组合根共享 action audit 与治理 strict callback。

## 验证

- `npx vitest run packages/core/src/governed-dispatch-service.test.ts packages/core/src/task-timeline-service.test.ts packages/core/src/task-claim-service.test.ts packages/core/src/runtime-node-registry-audit.test.ts packages/core/src/artifact-version-service.test.ts`: 21/21
- `npm run build`: passed
- `npm run gate:core-architecture`: passed
- `npm run gate:barrel-governance`: passed
- changed-file ESLint: passed

## 风险/后续

全量 server app 测试在 Windows 仍会出现既有 SQLite 临时目录 `EPERM` 清理失败；另有一个既有 Nomos 测试返回 400。未部署，需在部署前用真实 approved plan/baseline 做一次 adapter-neutral smoke。
