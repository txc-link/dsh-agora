# progress.md — P0 批次

## 2026-08-30

- 创建任务目录与决策记录。
- 下一步：GPU 实探 GPT-SoVITS API + connector 部署方式；实现 HttpSpeechAdapter。

## 2026-08-31

- P0-B 完成：`FishSpeechSpeechAdapter`（HTTP JSON POST /v1/tts，串行队列+超时）、
  config `provider: 'fish-speech'`、index 接线、导出；258/258 测试 + typecheck 通过。
- GPU 真机端到端验证：适配器直连 :8080 合成 3.67s WAV 成功。
- P0-A 完成（v0.4.0）：agora-rest 新增 pauseTask/resumeTask/cancelTask/unblockTask；
  slash 新增 `/agora task show|pause|resume|cancel|unblock <id> [reason]`；
  路由/客户端单测通过。approve/reject 不暴露（A4）。
- npm 发布 dsh-matrix-connector@0.4.0。
- GPU/Mac 依赖已更新为 0.4.0，speech 配置已写入；**等待用户重启 dsh-web 生效**。
- 阻塞项：securityBoundary/rootSpace 未定（语音投影未激活）；Mac 无直连 TTS 通道；
  GPT-SoVITS 模型缺失（备选，待补）。
