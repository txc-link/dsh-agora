# 01 — Companion Relationship Model

## 聚合边界

```text
AgentIdentity/Citizen
  └─ RelationshipProfile (owner_ref + agent_ref + kind)
       ├─ Version 1 (immutable)
       ├─ Version 2 (immutable, current)
       └─ SharedEpisode (future slice)
```

Relationship Profile 不改变 agent 的执行身份，只定义它如何与指定 owner 长期相处。

## 版本负载

- `personaCanon`: summary、traits、background、values、speakingStyle。
- `relationshipContract`: boundaries、accountabilityStyle、affectionStyle、transparency。
- `initiativePolicy`: enabled、quietHours、maxDailyInitiatives、allowedTriggers。
- `voicePreference`: locale、timbre、pace、pitch、expressiveness。

## 不变量

- 创建时产生 version 1。
- 修订只能追加 `currentVersion + 1`，历史版本不可覆盖。
- 主动消息关闭时，任何 routine 都不得创建主动投递。
- `maxDailyInitiatives` 必须有有限上限。
- 人设背景可以是虚构设定，但真实 SharedEpisode 只能来自实际交互或用户确认。
- companion 默认按成年人角色建模；不得克隆未授权现实人物身份或声音。

## 与生活/健康域关系

- companion 只能获得用户授权后的生活摘要。
- 健康 Vault 不直接暴露；只接收抽象 CareSignal。
- companion 不能生成诊断、修改用药或替代 Health Steward。

