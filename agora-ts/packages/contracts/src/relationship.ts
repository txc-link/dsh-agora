import { z } from 'zod';

const clockTimeSchema = z.string().regex(
  /^([01]\d|2[0-3]):[0-5]\d$/,
  'expected a 24-hour HH:mm time',
);

const timeZoneSchema = z.string().min(1).refine((value) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, 'expected an IANA time zone');

export const relationshipKindSchema = z.enum(['companion', 'friend', 'mentor', 'coach']);
export type RelationshipKindDto = z.infer<typeof relationshipKindSchema>;

export const relationshipProfileStatusSchema = z.enum(['active', 'paused', 'archived']);
export type RelationshipProfileStatusDto = z.infer<typeof relationshipProfileStatusSchema>;

export const relationshipInitiativeTriggerSchema = z.enum([
  'scheduled_check_in',
  'commitment_due',
  'milestone',
  'wellbeing_signal',
  'user_absence',
]);
export type RelationshipInitiativeTriggerDto = z.infer<typeof relationshipInitiativeTriggerSchema>;

export const personaCanonSchema = z.object({
  summary: z.string().min(1),
  traits: z.array(z.string().min(1)).min(1).max(32),
  background: z.array(z.string().min(1)).max(64),
  values: z.array(z.string().min(1)).max(32),
  speaking_style: z.array(z.string().min(1)).min(1).max(32),
}).strict();
export type PersonaCanonDto = z.infer<typeof personaCanonSchema>;

export const relationshipContractSchema = z.object({
  boundaries: z.array(z.string().min(1)).max(64),
  accountability_style: z.enum(['gentle', 'balanced', 'firm', 'custom']),
  affection_style: z.enum(['reserved', 'warm', 'playful', 'romantic']),
  transparency: z.literal('ai_disclosed'),
}).strict();
export type RelationshipContractDto = z.infer<typeof relationshipContractSchema>;

export const initiativePolicySchema = z.object({
  enabled: z.boolean(),
  quiet_hours: z.object({
    start: clockTimeSchema,
    end: clockTimeSchema,
    timezone: timeZoneSchema,
  }).strict().nullable(),
  max_daily_initiatives: z.number().int().min(0).max(10),
  allowed_triggers: z.array(relationshipInitiativeTriggerSchema).max(16),
}).strict().superRefine((value, context) => {
  if (value.enabled && value.max_daily_initiatives === 0) {
    context.addIssue({
      code: 'custom',
      path: ['max_daily_initiatives'],
      message: 'enabled initiative policy requires a positive daily limit',
    });
  }
});
export type InitiativePolicyDto = z.infer<typeof initiativePolicySchema>;

export const voicePreferenceSchema = z.object({
  locale: z.string().min(2),
  timbre: z.string().min(1),
  pace: z.number().min(0.5).max(2),
  pitch: z.number().min(-12).max(12),
  expressiveness: z.enum(['low', 'medium', 'high']),
  style_tags: z.array(z.string().min(1)).max(32),
}).strict();
export type VoicePreferenceDto = z.infer<typeof voicePreferenceSchema>;

export const relationshipProfileVersionPayloadSchema = z.object({
  persona_canon: personaCanonSchema,
  relationship_contract: relationshipContractSchema,
  initiative_policy: initiativePolicySchema,
  voice_preference: voicePreferenceSchema,
}).strict();
export type RelationshipProfileVersionPayloadDto = z.infer<typeof relationshipProfileVersionPayloadSchema>;

export const createRelationshipProfileRequestSchema = z.object({
  profile_id: z.string().min(1),
  owner_ref: z.string().min(1),
  agent_ref: z.string().min(1),
  relationship_kind: relationshipKindSchema,
  display_name: z.string().min(1),
  payload: relationshipProfileVersionPayloadSchema,
  created_by: z.string().min(1),
  change_note: z.string().min(1).optional(),
}).strict();
export type CreateRelationshipProfileRequestDto = z.infer<typeof createRelationshipProfileRequestSchema>;

export const reviseRelationshipProfileRequestSchema = z.object({
  profile_id: z.string().min(1),
  expected_current_version: z.number().int().positive(),
  payload: relationshipProfileVersionPayloadSchema,
  created_by: z.string().min(1),
  change_note: z.string().min(1).optional(),
}).strict();
export type ReviseRelationshipProfileRequestDto = z.infer<typeof reviseRelationshipProfileRequestSchema>;

export const setRelationshipProfileStatusRequestSchema = z.object({
  profile_id: z.string().min(1),
  expected_current_version: z.number().int().positive(),
  status: relationshipProfileStatusSchema,
}).strict();
export type SetRelationshipProfileStatusRequestDto = z.infer<typeof setRelationshipProfileStatusRequestSchema>;

export interface RelationshipProfileRecord {
  profile_id: string;
  owner_ref: string;
  agent_ref: string;
  relationship_kind: RelationshipKindDto;
  display_name: string;
  status: RelationshipProfileStatusDto;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface RelationshipProfileVersionRecord {
  profile_id: string;
  version: number;
  payload: RelationshipProfileVersionPayloadDto;
  created_by: string;
  change_note: string | null;
  created_at: string;
}

export interface RelationshipProfileSnapshotDto {
  profile: RelationshipProfileRecord;
  version: RelationshipProfileVersionRecord;
}

export interface CreateRelationshipProfileInput {
  profile: RelationshipProfileRecord;
  version: RelationshipProfileVersionRecord;
}

export interface AppendRelationshipProfileVersionInput {
  profile_id: string;
  expected_current_version: number;
  version: RelationshipProfileVersionRecord;
  updated_at: string;
}

export const relationshipInitiativeModalitySchema = z.enum(['text', 'voice']);
export type RelationshipInitiativeModalityDto = z.infer<typeof relationshipInitiativeModalitySchema>;

export const relationshipInitiativeStatusSchema = z.enum([
  'scheduled', 'claimed', 'delivered', 'failed', 'cancelled',
]);
export type RelationshipInitiativeStatusDto = z.infer<typeof relationshipInitiativeStatusSchema>;

export const scheduleRelationshipInitiativeRequestSchema = z.object({
  profile_id: z.string().min(1),
  trigger: relationshipInitiativeTriggerSchema,
  modality: relationshipInitiativeModalitySchema,
  text: z.string().min(1).max(8000),
  resource_ref: z.string().min(1),
  source_domain: z.string().min(1),
  target_domain: z.string().min(1),
  delivery_binding_ref: z.string().min(1),
  purpose: z.string().min(1),
  scheduled_for: z.string().datetime({ offset: true }),
  requested_fields: z.array(z.string().min(1)).max(128).default(['text']),
}).strict();
export type ScheduleRelationshipInitiativeRequestDto = z.infer<typeof scheduleRelationshipInitiativeRequestSchema>;

export interface RelationshipInitiativeRecord {
  id: string;
  profile_id: string;
  profile_version: number;
  owner_ref: string;
  agent_ref: string;
  trigger: RelationshipInitiativeTriggerDto;
  modality: RelationshipInitiativeModalityDto;
  text: string;
  resource_ref: string;
  source_domain: string;
  target_domain: string;
  delivery_binding_ref: string;
  purpose: string;
  requested_fields: string[];
  scheduled_for: string;
  schedule_local_date: string;
  status: RelationshipInitiativeStatusDto;
  consumer_ref: string | null;
  lease_token: string | null;
  lease_expires_at: string | null;
  attempt_count: number;
  last_error: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimRelationshipInitiativesInput {
  consumer_ref: string;
  target_domain: string;
  now: string;
  lease_expires_at: string;
  limit: number;
  lease_token_factory: () => string;
}
