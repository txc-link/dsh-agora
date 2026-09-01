# 版本握手、三节点故障回归与安全域激活

## 版本握手
`POST /api/runtime-handshake` 接收 protocol、plugin_version、instance_id、capabilities，Core 返回兼容性、最低版本与缺失能力。dsh-agora-plugin 启动心跳前执行握手，拒绝时保持 error 状态。

## 三节点回归
测试使用 node-mac、node-home-linux、node-work-windows：重复心跳不增加节点；将节点标为 stale 后以新 instance_id 重启可接管并恢复 online。Matrix 事件继续通过 event id claim 防重复投递。

## 安全域上线顺序
Life、Health、Companion 与 Company 使用不同顶层 Space、专用 bot 身份和 connector。`SecurityDomainBoundary.validateActivationPlan` 要求握手和故障恢复证据均为 true；因此本阶段只提供门禁与配置能力，不自动改线上配置。
