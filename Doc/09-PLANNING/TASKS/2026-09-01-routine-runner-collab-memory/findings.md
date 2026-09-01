# Findings

- `RoutineService` 已支持 create/list/claimDue/markSucceeded/markFailed，但 server observation scheduler 当前只扫描任务、通知、Brain 和 memory summary，没有消费 routine runs。
- `RuntimeNodeRegistryService` 已提供 dispatch 创建、claim、renew、progress、complete；RoutineRunner 应复用这些 provider-neutral 端口，不在 Core 启动 provider 进程。
- `TaskMemorySummaryService` 目前按 SHA-256 指纹幂等写入一段确定性文本；可以在不改变 fingerprint/原始对话存储的前提下增加结构化摘要 provider 和元数据。
- Matrix connector 已将绑定房间普通消息回流 Core conversation，并提供 `task collab|timeline|context`；目前没有显式点名唤醒、轮次预算或 bot-to-bot 冷却控制。
- Matrix 房间仍是投影和入口，Core task/conversation/coordination 才是权威状态。
