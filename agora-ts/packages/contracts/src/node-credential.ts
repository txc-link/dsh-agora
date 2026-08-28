import { z } from 'zod';

export const runtimeNodeCredentialScopeSchema = z.enum(['heartbeat', 'dispatch', 'delivery']);
export type RuntimeNodeCredentialScopeDto = z.infer<typeof runtimeNodeCredentialScopeSchema>;

export const issueRuntimeNodeCredentialRequestSchema = z.object({
  scopes: z.array(runtimeNodeCredentialScopeSchema).min(1),
  expires_in_seconds: z.number().int().min(60).max(31_536_000).nullable().optional(),
  label: z.string().min(1).max(256).nullable().optional(),
}).strict();

export const runtimeNodeCredentialSchema = z.object({
  id: z.string().min(1),
  node_id: z.string().min(1),
  scopes: z.array(runtimeNodeCredentialScopeSchema).min(1),
  label: z.string().nullable(),
  status: z.enum(['active', 'revoked', 'rotated']),
  created_at: z.string(),
  expires_at: z.string().nullable(),
  last_used_at: z.string().nullable(),
  rotated_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
});
export type RuntimeNodeCredentialDto = z.infer<typeof runtimeNodeCredentialSchema>;

export const issuedRuntimeNodeCredentialSchema = z.object({
  credential: runtimeNodeCredentialSchema,
  token: z.string().min(32),
});
export type IssuedRuntimeNodeCredentialDto = z.infer<typeof issuedRuntimeNodeCredentialSchema>;

export const runtimeNodeCredentialListResponseSchema = z.object({ credentials: z.array(runtimeNodeCredentialSchema) });
