import { z } from 'zod';

export const runtimeHandshakeRequestSchema = z.object({
  protocol: z.string().min(1),
  plugin_version: z.string().min(1),
  instance_id: z.string().min(1),
  capabilities: z.array(z.string().min(1)).default([]),
}).strict();
export type RuntimeHandshakeRequestDto = z.infer<typeof runtimeHandshakeRequestSchema>;

export const runtimeHandshakeResponseSchema = z.object({
  compatible: z.boolean(), protocol: z.string().min(1), core_version: z.string().min(1),
  min_plugin_version: z.string().min(1), required_capabilities: z.array(z.string().min(1)),
  missing_capabilities: z.array(z.string().min(1)), reason: z.string().nullable(),
}).strict();
export type RuntimeHandshakeResponseDto = z.infer<typeof runtimeHandshakeResponseSchema>;
