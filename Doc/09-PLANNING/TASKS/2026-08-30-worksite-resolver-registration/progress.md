# T-2 Progress (2026-08-30)

## 状态

✅ **R-A 真接入 + R-H scopeAuthResolver worksite 完成**

## 验证

- **8 新 test pass**: 4 scope-auth-policy + 4 worksite-scope-auth-integration
- **worksite 域 85/85 pass** (旧 77 + 新 8)
- **build**: 0
- **typecheck**: 0
- **全回归**: 1323/1360 pass (37 fail = baseline 36 EROFS + 1 locale, **0 回归** vs turn 122 baseline 1315)

## 变更范围

6 文件（见 findings.md §6）

## 用户立即可见效果

```
Before:
$ agora-ts borrow create --target agora://task/T-1 --scope agora://task/T-1 --permissions read,execute --reason "smoke"
CLI 错误: "scope authorization missing"  (env 未设)

After:
$ agora-ts borrow create --target agora://task/T-1 --scope agora://task/T-1 --permissions read,execute --reason "smoke"
{
  "ok": true,
  "request": { ... },
  "decision": { "outcome": "granted" }
}
```

不需要手设 `AGORA_BORROW_SCOPE` / `AGORA_BORROW_POSTURE` / `AGORA_BORROW_PERMISSIONS`.

## §1 compliance

- `scope-auth-policy.ts` 零平台名 (只 import TaskRecord + types/uri)
- `toTaskWorksite` 注入 scopeAuthorization 但不知道平台
- registry 实例化但 `void registry` 是设计预留 (Phase 2 thread 接入时无缝替换)
- ThreadWorksiteResolver 仍未注册 (R-C-2 推)

## 风险标注 (来自 risk team)

- ⚠️ Phase 1 permissions = read+execute (无 write/delete). Phase 2 需 ACL 注入
- ⚠️ scopeAuthorizationFromEnv stub 保留 (test double 可能引用, 删了会破)
- ⚠️ dev machine E2E 没跑 (沙箱 EROFS)

## 下一步

| # | 任务 | 工作量 | 说明 |
|---|---|---|---|
| 1 | **R-D** T-3 matrix reply-to → agora inbox | 3-4h | 解锁 tier1 critical path |
| 2 | **R-C-2** matrix adapter Task title→room name | 4-5h 跨仓 | 闭环 R-C |
| 3 | **R-F** Dashboard 前端 | 5-7h | 需 R-D 数据流 |

下一个 PR 推 R-D。要继续吗?