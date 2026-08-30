# 03 — Information, Consent, and Action-Risk Governance

## 同一 Core，独立安全域

```text
Agora Core
├─ Company domain   -> Company Matrix Space (top-level, company bot)
├─ Life domain      -> Life Matrix Space (top-level, life bot)
├─ Health domain    -> Health Matrix Space (top-level, health bot/key policy)
└─ Companion domain -> Companion Matrix Space (top-level, companion bot)
         ^
         └─ one logical EA routes by explicit domain authority
```

Life、Health、Companion 都不建立为 Company Space 子空间，也不复用 Company
connector 身份。EA 可以在 Core 中拥有多个域的受控能力，但不能凭角色自动读取
全部数据。

## InformationPolicy

- `resource_ref + immutable version`
- owner/domain/sensitivity/sharing mode
- allowed purposes
- retention deadline
- provenance (`created_by`, `change_note`, `created_at`)

跨域默认拒绝；`explicit_consent_only` 在同域内也不会自动开放给非 owner。

## ConsentGrant

授权同时约束：grantor、grantee、资源 pattern、源域、目标域、purpose、permission、fields、最高 sensitivity、basis、expiry 和 evidence。

`sensitive_personal` 必须使用 explicit basis 且必须有 expiry。撤销保留证据，不删除历史记录。

## ActionRisk

每次可能产生副作用的动作先记录 ActionIntent 并生成不可变评估：

- risk level: low / medium / high / critical
- decision: allow / require_human_gate / deny
- reasons
- policy version

`strict-personal-v1` 下，任何支付、订阅、敏感披露、健康影响、不可逆动作或第三方副作用都要求 Human Gate。

## 与 Matrix adapter 的契约

- 每个受管 Space/Room 绑定 `security_domain`。
- Company 与 Personal Office 只能是独立顶层 Space。
- 每个保护域使用独立 bot user/device/crypto store；同一身份跨域在部署校验中拒绝。
- 投递前使用 resource policy + consent authorize；adapter 只执行允许的投影结果。
- Core 不出现 Matrix room id；room/domain 映射只存在 adapter 持久层。
- 健康或高敏数据正式上线前，durable E2EE crypto store 与 key backup 是硬 Gate；
  顶层 Space/独立身份只解决访问与误投边界，不替代传输加密。
