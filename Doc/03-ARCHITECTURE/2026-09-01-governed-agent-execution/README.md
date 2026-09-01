# Governed Agent Execution Foundation

**Date**: 2026-09-01 (Asia/Shanghai)
**Status**: implementation slice complete; repository-wide cleanup remains separately tracked
**Source**: UniGeoEarth AI architecture review and Agora implementation plan

## Confirmed design

Agora keeps one Core semantic model and provider adapters. The first reusable governance chain is:

`TaskSpecRevision → ApprovalRecord reference → ExecutionBaseline → EvidenceManifest`.

Each object is append-only, stores exact digests/references, and is independently queryable after restart. Existing task, coordination, artifact, consent, and action-risk records remain their own sources of truth.

## Implemented surface

- `@agora-ts/contracts` exposes strict DTOs and list response schemas.
- SQLite migration `047_governed_execution.sql` and provider-neutral repositories persist the chain across restart.
- `GovernedExecutionService` enforces append-only revision parents, exact digest matches, expiry, baseline status, and idempotency.
- REST exposes create/list routes under `/api/tasks/:taskId/{spec-revisions,execution-baselines,evidence-manifests}`.
- CLI exposes `agora execution revision append|list|show`, plus baseline/evidence list/show. Baseline creation remains Dashboard-gated.

## Deferred topics

- CollaborationRequirement, CollaborationPlan, and DelegationAuthority;
- ActionAttempt, ActionReceipt, and readback;
- AgentCompositionManifest and Skill admission/adoption/invocation;
- ExperienceObservation and governed experience promotion.

## Boundary

No GIS-specific data products, STAC/PostGIS, MLflow, or deployment split is introduced by this slice.
