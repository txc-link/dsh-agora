# Findings

- Dispatch `dispatch-e586e300-cce2-43ec-93f7-49a8fc4d4e87` reached the runtime successfully but reused session `session-7c968a24-6a4a-43eb-88e4-cc37142bfb9a`.
- The DeepSeek harness refused the task because `obsiandian` was not in its known/authorized entity list and the dispatch header did not carry a vault path.
- The configured home vault is `/home/ailink/vaults/Austin/`; this is safe metadata and is not a credential.
- The runtime prompt already forbids exposing passwords, private keys, and tokens. The fix must make the source binding explicit without weakening that boundary.
- A real regression against the original Matrix wording proved prompt-only protection insufficient: the model read the vault but echoed password fields. A result-level DLP boundary is required before durable completion and IM delivery.
- Unknown research subjects must not be treated as unresolved resources. Only explicit access to a system/data source requires a resource binding.
- The registry is intentionally safe metadata only; current deployment has five resources (Obsidian plus four SSH endpoints) and no raw credential fields.
