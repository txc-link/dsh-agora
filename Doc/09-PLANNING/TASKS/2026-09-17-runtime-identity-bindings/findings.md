# Findings

- Live Agora node inventory currently has `node-home-linux`, `node-mac`, and `node-work-windows`; each currently advertises one `default` DSH agent.
- `node-home-linux` is the home GPU Linux host (NVIDIA GPUs confirmed); its SSH reverse tunnel is the configured port 16000.
- Existing runtime target refs such as `dsh:node-home-linux:default` must remain stable; changing them would break existing task bindings.
- Current DSH plugin supports node-level metadata but not per-agent metadata; the roster receives agent metadata in its TypeScript contract already.
- The supplied Mac value is an HTTPS URL/port, not a confirmed SSH endpoint; it should not be labeled `ssh` until protocol is verified.
- Work Windows has no externally reachable SSH and should be represented as local-only/unreachable.
- The live Matrix cluster (`matrix-agentd`) deliberately only handled explicitly addressed messages; the bridge excludes the same shared room because multi-identity routing owns it. Therefore enabling connector natural-chat alone would create duplicate replies or still remain disabled.
- `agent9` is the existing “团队调度” role with the Hermes runner, so it is the least surprising default manager. The manager receives all role cards and emits a bounded `<agentd-dispatch>` JSON block; the daemon validates targets against the role source before sending explicit Matrix mentions.
