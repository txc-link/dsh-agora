# 组织化 agent 工作 OS — matrix IM 入口架构

## 1. 来源

- 讨论日期：2026-08-28（turn 25-26）
- 来源对话：DSH agent（资深架构师视角）三角色交叉审视
- 用户最终目标："让 agent 有组织、有架构、有计划、主动协同受控完成长期工作、管理资源"
- 用户三个决策（2026-08-28 turn 26）：**三个 "是"**
  - Q1：组织化 OS 已存在，IM 入口是缺失环节 → **是**
  - Q2：v0.1 = matrix 看见 citizen / 触发派发 / 审阅工件 → **是**
  - Q3：等三题答案后再决定 → **是（已答）**

## 2. 核心判断

**Agora Core 不是一个空白画布——它已经建成了一个组织化 agent 工作 OS 的完整骨架**。dsh-matrix-connector 不是"从零设计的入口"，而是 **Core 已有能力的第二个 IM 入口实现**（第一个是 cc-connect）。

## 3. 子文档索引

| # | 标题 | 状态 |
|---|---|---|
| 01 | 组织化 OS 全貌（Core 已建成的能力清单） | ✅ done |
| 02 | dsh-matrix-connector 在 OS 中的位置 | ✅ done |
| 03 | v0.1 范围（matrix 房间 = agora citizen 会议室） | ✅ done |
| 04 | v0.2 范围（matrix 房间 = agora 上下文投影屏） | pending |
| 05 | v1.0 范围（matrix 房间 = agent 组织作战室） | pending |
| 06 | 落地方案（仓 / worktree / TDD / 回写） | pending |
| undecided | 未决问题兜底 | pending |

## 4. 路线图

```
v0.1 (4 周)        v0.2 (8 周)            v1.0 (16 周)
会议室               投影屏                   作战室
citizen 可见        context 流              多 agent 协同
派发 / 审批         工件 + brain 检索       A2A + attention routing
                    inbox 通知             host resource 面板
                                            merge proposal 审批
```

## 5. 已废弃的旧文档

`Doc/03-ARCHITECTURE/_superseded/2026-08-28-dsh-matrix-entry-adapter-v1/`
（旧版基于"matrix 空白画布"错误前提，仅作历史依据保留）

## 6. 一句话总结

**dsh-matrix-connector = Agora 组织化 OS 的第二个 IM 入口实现。v0.1 让人类在 matrix 房间看见公民、触发派发、审阅工件；v1.0 让 matrix 房间成为 agent 组织的作战室**。

## 7. 现在

你已确认三题"是"。**是否立即动手开 worktree + 写 task_plan + 写 RED test**？