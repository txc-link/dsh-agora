# Walkthrough — Personal Companion governance v0.1

## Delivered vertical slice

1. Create a versioned RelationshipProfile with disclosed AI identity, persona
   canon, boundaries, quiet hours, daily initiative limit, and portable voice
   preferences.
2. Classify the outgoing care text with an immutable InformationPolicy.
3. Schedule a provider-neutral RelationshipInitiative using an opaque delivery
   binding, not a Matrix room id.
4. A domain-bound connector leases due rows. Expired leases are reclaimable
   after restart.
5. Before delivery, Core evaluates purpose/fields/domain consent and records an
   immutable action-risk assessment.
6. Connector locally synthesizes WAV, uploads standard Matrix `m.audio`, and
   acknowledges delivered/failed using the lease token.

## Security result

Company, Life, Health, and Companion share one Core but not one Matrix security
boundary. Each protected domain is a top-level Space with a dedicated bot
identity/device/crypto store. One logical EA routes between domains only with
explicit Core authority.

## Verification

- Workspace TypeScript build passes.
- New Core/DB/CLI/REST tests pass (24 assertions in the focused run).
- Connector full regression passes 212/212.
- Local Windows SAPI Chinese WAV smoke passes.
- Remote Core was updated to `e5b6e16`, built on the server, and
  `agora.service` restarted active. Health, relationship, initiative, and
  consent routes all return authenticated 200.
- `dsh-matrix-connector@0.2.1` is published as npm `latest`; node-b installs the
  registry version and passes DSH HTTP plus Matrix identity/sync verification.

## Deployment gate

The Core rollout is complete. Synapse public registration is disabled, so the
remaining deployment gate is admin provisioning of dedicated
Life/Health/Companion identities plus a recovery-tested durable E2EE store.
Reusing the existing Company bot remains explicitly rejected because it would
only simulate isolation.
