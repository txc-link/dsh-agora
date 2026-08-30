# Findings — Element agent workspace sample

## Existing runnable surfaces

- Element/Matrix provides Spaces, rooms, room attachments, a room file list,
  voice messages, and threaded replies.
- `dsh-matrix-connector` can bind one connector identity to one strong security
  domain and one top-level Space. Protected domains reject nesting and identity
  reuse at the connector boundary.
- Company organization, positions, employment, EA intake, and commitments are
  durable Core records and have CLI/REST plus a thin Matrix entry.
- Mem0 is wired through `agora experience add/search/list`; `scopeRef` maps to
  self-hosted Mem0 `user_id`, and `m0sk_` keys use `X-API-Key`.
- Obsidian output is runnable through `agora forum export --vault`; it writes
  Markdown directly to a local vault and is idempotent by forum post id.
- Obsidian REST retrieval exists as a read-only context-source adapter, but the
  current public CLI has no single setup command for authoring that binding.
- Companion profile, proactive initiative, consent, information classification,
  action-risk assessment, and standard Matrix `m.audio` delivery exist.

## Important limits

- An Element thread is not a durable Agora Forum post. Element currently has no
  generic Discord-style forum-channel surface in this deployment.
- A Matrix attachment is not the document SSoT and has no Obsidian/Git-style
  document lifecycle. Matrix should be intake/discussion/delivery; Obsidian and
  Core should retain the canonical artifact, decision, and provenance.
- Normal room messages and attachments are not automatically written to Mem0 or
  Obsidian by the current connector. Mem0 recording and forum export are explicit
  CLI/lifecycle actions today.
- The current connector does not have a recovery-tested durable E2EE crypto
  store. Health and sensitive companion content must remain deployment-blocked;
  enabling E2EE in Element would also prevent the current connector from
  participating correctly.
- Infrastructure nodes/bot identities are not business roles. A role may be
  rebound to another runtime node without changing its organization identity.

## Design choice for the sample

Use four independent top-level Spaces: Company, Personal Office, Health Vault,
and Companion. `@root:agent-hub.local` is the only human owner across all four;
each protected domain gets a dedicated connector identity and least-privilege
room membership. The three existing node bots remain Company execution
identities until protected-domain bot identities and durable E2EE are ready.
