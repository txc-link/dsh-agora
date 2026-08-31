# 2026-08-31 next-batch — handoff commands (2/3/4 ready, awaiting user authorization)

> Step 1 已执行：两个 feat 分支 ff-合入 master/main，worktree 清理，feat 分支删除。
> 
> Step 2/3/4 不直接执行 —— approval policy = ask（push 与 publish 均为外部权限边界操作，T_transfer 6 项决策需要用户拍板）。
> 下面是可直接复制的命令与决策表单。

---

## Step 2 — git push（待用户授权）

### 2a. dsh-agora master → origin/master

当前 master @ `28b119b`，origin/master @ `2fd3ce1`（prev P0 batch）。13 commits ahead, 0 behind, fast-forward.

```bash
cd /home/ailink/dsh-agora
git push origin master
```

风险评估：低（线性 ff，无冲突）。仅 13 commits，全部为本批 produced + reviewed。

### 2b. dsh-matrix-connector main → origin/main

当前 main @ `d33dd49`（领先 origin/main 1 commit：71c01af 0.5.2 fix）+ 4 新 commits（next-batch 5 ahead of origin/main）。

```bash
cd /home/ailink/dsh-matrix-connector
git push origin main
```

风险评估：低（线性 ff）。但注意 **0.5.2 fix 此前已在本仓内 ff-合入 main 但未推送**；这次推送会同时把 0.5.2 与 0.6.0（含 next-batch 全量）一起推到 origin。请确认这符合预期。

---

## Step 3 — npm publish（待用户授权 + tag 信息）

dsh-matrix-connector 0.6.0 tgz 已生成：`/home/ailink/dsh-matrix-connector-0.6.0.tgz` (127 KB)。

发布所需决策（4 项）：
1. **npm registry**: 默认 `registry.npmjs.org`？还是公司私有 registry（`npmmirror.com` 镜像 / 公司内部 `registry.tx...`）？
2. **npm tag**: `next-batch` (建议) / `beta` / `latest`？影响 `npm install dsh-matrix-connector@next-batch` 的语义。
3. **npm 2FA**: 是否启用 `--otp=<code>`？发布前需 `npm login` + 配置 2FA 一次性密码。
4. **发布时机**: 立刻 / 等监控/Element Call SFU 部署齐了再发 / 等 Grafana 鉴权决策定下来再发。

执行命令（在用户答复 1-4 后跑）：

```bash
cd /home/ailink/dsh-matrix-connector
npm login                                # 用户交互
# （输入 4 个决策后）
npm publish --access public --tag <decided-tag>
# 或：npm publish --access public --tag <tag> --otp=<code>
```

---

## Step 4 — T_transfer 设计文档 §9 的 6 项决策

> Source: `dsh-agora/Doc/09-PLANNING/TASKS/2026-08-31-next-batch/follow-up-T-transfer-design.md` §9

每项给出 (a) 默认建议 (按 §1.5 短路径) + (b) 影响 + (c) 用户答复。

### 4.1 跨组织转派是否需要 organization admin 二次确认

- **建议 (a)**: 是。跨组织 = 跨治理域，必须 org admin gate (与现有 employment transfer 路由一致)。
- **影响 (b)**: gate_type=`task_transfer` 加 `assertCrossOrgAdmin(actor, from_org, to_org)`；本地转派走 dashboard session 即可。
- **用户答复 (c)**: ___

### 4.2 进行中 craftsman execution 在转派后是否自动中断

- **建议 (a)**: 保留至完成 + 允许新 assignee 并发新 execution。下游产物在 `task.runtime_bindings` 上多一个 `retry_after_transfer: true` 标记，新 execution 可参考。
- **影响 (b)**: 不中断用户上下文；下游 cost 翻倍（可接受，因转派是低频操作）。
- **用户答复 (c)**: ___

### 4.3 transfer 历史是否暴露给被转派 agent

- **建议 (a)**: 否。被转派 agent 看到的是"你被 assign 到 task X"，不看到前任。Human viewer (dashboard) 看到完整 history。
- **影响 (b)**: agent perspective API 返回 sanitized view（隐藏 from_runtime + decided_by）；dashboard view 完整。
- **用户答复 (c)**: ___

### 4.4 转派是否同时改写 commitment ledger

- **建议 (a)**: 否。Commitment 是承诺账，与 task execution 是两个抽象层；转派不改承诺。Commitment 服务在 task 转派时收到通知事件，自行决定是否调整（默认不动）。
- **影响 (b)**: CommitmentService 不动；TaskTransferService 发 `task_transferred` event 让 Commitment 订阅。
- **用户答复 (c)**: ___

### 4.5 retention：task_transfers 永久保留 vs N 月后归档

- **建议 (a)**: 永久保留 + 提供 archive table。Hot path 查近 90 天的转派（dashboard 默认窗口）；老记录走 archive（仍在 DB，只是 dashboard 默认不查）。
- **影响 (b)**: schema 加 `archived_at` 字段 + archive 视图；retention worker 月度跑。
- **用户答复 (c)**: ___

### 4.6 批量转派（同一时刻把一组任务转给同一 runtime）

- **建议 (a)**: 不在 v0.1 实现。v0.1 只支持单 task；批量用脚本循环 v0.1 端点即可。Verdict §3 提到批量是 P2 评估。
- **影响 (b)**: v0.1 REST 端点保持 `POST /api/tasks/:id/transfer` 单 task；批量语义留 v0.2。
- **用户答复 (c)**: ___

---

## 同步建议（不算在 1-4，但相关）

- **A**: 现在立刻 push+publish，把 0.6.0 推到 npm + 推到 GitHub（最快路径，但 Grafana / Element Call 部署还没齐）
- **B**: 先 push GitHub（merge 可见），publish 等部署齐再发（保守路径）
- **C**: 全部停下来，先去部署 Radicale + monitoring-relay（依赖实际部署才能端到端冒烟），然后再回来推+发
