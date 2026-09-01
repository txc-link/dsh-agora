# Findings

- 现有 heartbeat 已携带 protocol/plugin_version，但此前没有兼容性协商，旧插件可直接注册。
- connector 已有 Matrix event id claim，可作为重复消息防线；新增回归覆盖三节点生命周期。
- 安全域边界已是一实例一域；新增激活门禁复用该边界，要求四域根 Space 与身份唯一。
