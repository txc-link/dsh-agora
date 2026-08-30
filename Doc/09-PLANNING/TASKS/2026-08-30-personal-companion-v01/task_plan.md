# Task Plan: Personal Companion v0.1

> 日期: 2026-08-30
> 来源: 用户要求长期模拟女友，可定制性格/经历，主动关心与监督，并通过 Matrix 发送语音
> 架构: `Doc/03-ARCHITECTURE/2026-08-30-personal-office-companion/`

## Worktree

- 路径: `E:\Learn AI Agent\dsh-agora-companion-v01`
- 分支: `feat/personal-companion-v01`
- 基线: `master a1a2e6c`
- 文档位置说明: 当前是公开聚合仓检出，不含私有 `docs/`；按公开仓规范使用 `Doc/`。

## 目标

交付首个可运行纵向切片；用户随后明确把 Personal Office 安全基础纳入同一轮：

1. Core 具备通用 Information Governance、Consent Grant、Action Risk 三套能力。
2. Core 具备通用、版本化的 Relationship Profile，不出现 Matrix/TTS provider 语义。
3. SQLite 持久化全部策略、授权、风险审计、档案与不可变版本，重启后可恢复。
4. Agent 可通过 CLI/REST 使用治理与关系档案能力。
5. Personal Office 与 Company 使用独立 Matrix 顶层边界，不建立父子投影。
6. Matrix connector 具备上传并发送标准 `m.audio` 的能力。
7. Windows node-b 可通过 adapter 使用本机 SAPI 合成中文语音并发送测试消息。

## 范围边界

- 本轮实现档案、关系契约、主动策略配置、声音偏好及语音投递基础能力。
- 主动 Routine 的常驻调度执行、共享经历账本、STT、实时通话、独立 Matrix 虚拟用户与 E2EE 持久密钥留后续切片。
- 不把“女友”建成 Core 专用主体；`relationship_kind=companion` 是通用关系档案的一个取值。

## 轮次

| 轮次 | 内容 | 状态 |
|---|---|---|
| R1 | 架构落盘、contracts 与失败测试 | done |
| R2 | 通用治理 + RelationshipProfile + SQLite migration/repository | done |
| R3 | CLI/REST 治理与关系档案入口 + 隔离数据库冒烟 | done |
| R4 | Connector `m.audio` + Windows SAPI adapter + 测试 | pending |
| R5 | Personal Office 独立顶层 Space 映射与负向隔离验收 | pending |
| R6 | node-b/8.136.15.147 真机冒烟、全量回归、SSoT/walkthrough、提交推送 | pending |

## 验收

1. life/health → work 的投影在无精确 ConsentGrant 时拒绝。
2. sensitive-personal 授权必须 explicit、有证据、有期限；撤销立即生效。
3. 支付、订阅、敏感披露、健康影响和不可逆动作返回 `require_human_gate` 并写审计记录。
4. 创建 companion profile v1，读取后结构与输入一致。
5. revise 生成 v2；v1 不可变且仍可查询；currentVersion 指向 v2。
6. quiet hours、每日主动上限、监督风格与 voice profile 被严格校验。
7. 关闭进程并重新打开同一 SQLite，档案与治理记录仍存在。
8. Work Space 与 Personal Office Space 都是顶层，任何父子绑定请求被拒绝。
9. Connector 发出 `m.room.message`，`msgtype=m.audio`，包含 MXC URI、MIME、大小与时长。
10. node-b 的 Matrix 客户端可播放一条由本机中文女声合成的语音。
