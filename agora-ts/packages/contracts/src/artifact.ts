import { z } from 'zod';

export const artifactOwnerKindSchema = z.enum(['task', 'dispatch', 'coordination_run', 'memory', 'merge_proposal', 'other']);

export const createArtifactRequestSchema = z.object({
  name: z.string().min(1).max(512),
  kind: z.string().min(1).max(128),
  media_type: z.string().min(1).max(256),
  content_base64: z.string().min(1).max(8_000_000),
  owner_kind: artifactOwnerKindSchema,
  owner_ref: z.string().min(1).max(256),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
}).strict();
export type CreateArtifactRequestDto = z.infer<typeof createArtifactRequestSchema>;

export const artifactSchema = createArtifactRequestSchema.omit({ content_base64: true }).extend({
  id: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  size_bytes: z.number().int().nonnegative(),
  content_uri: z.string().min(1),
  created_at: z.string(),
});
export type ArtifactDto = z.infer<typeof artifactSchema>;

export const artifactListResponseSchema = z.object({ artifacts: z.array(artifactSchema) });

// ─── Markdown collaborative document (2026-08-31 next-batch) ──────────────
// v0.1: single-writer + content-addressed versioning. Each submit creates
// a new artifact (sha256 keyed); the client may pass parentArtifactId as
// a hint for history traversal but the chain is reconstructed from the
// artifact list filtered by owner_ref.

export const markdownDocumentResponseSchema = z.object({
  artifact_id: z.string().min(1),
  content: z.string(),
  content_hash: z.string().regex(/^[a-f0-9]{64}$/u),
  size_bytes: z.number().int().nonnegative(),
  created_at: z.string(),
  parent_artifact_id: z.string().nullable(),
});
export type MarkdownDocumentResponseDto = z.infer<typeof markdownDocumentResponseSchema>;

export const submitMarkdownRequestSchema = z.object({
  content: z.string().min(1).max(1_000_000),
  parent_artifact_id: z.string().min(1).optional(),
}).strict();
export type SubmitMarkdownRequestDto = z.infer<typeof submitMarkdownRequestSchema>;

export const markdownSubmitResponseSchema = z.object({
  artifact: artifactSchema,
  content_hash: z.string().regex(/^[a-f0-9]{64}$/u),
  is_new_version: z.boolean(),
});
export type MarkdownSubmitResponseDto = z.infer<typeof markdownSubmitResponseSchema>;
