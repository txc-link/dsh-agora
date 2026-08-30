import { z } from 'zod';

export const sensitivityLevelSchema = z.enum([
  'public',
  'internal',
  'personal',
  'sensitive_personal',
]);
export type SensitivityLevelDto = z.infer<typeof sensitivityLevelSchema>;

export const informationSharingModeSchema = z.enum([
  'public',
  'same_domain',
  'explicit_consent_only',
]);
export type InformationSharingModeDto = z.infer<typeof informationSharingModeSchema>;

export const classifyInformationRequestSchema = z.object({
  resource_ref: z.string().min(1),
  owner_ref: z.string().min(1),
  domain: z.string().min(1),
  sensitivity: sensitivityLevelSchema,
  sharing_mode: informationSharingModeSchema,
  allowed_purposes: z.array(z.string().min(1)).min(1).max(32),
  retention_until: z.string().datetime().nullable(),
  created_by: z.string().min(1),
  change_note: z.string().min(1).optional(),
}).strict();
export type ClassifyInformationRequestDto = z.infer<typeof classifyInformationRequestSchema>;

export const reclassifyInformationRequestSchema = z.object({
  resource_ref: z.string().min(1),
  expected_current_version: z.number().int().positive(),
  domain: z.string().min(1).optional(),
  sensitivity: sensitivityLevelSchema,
  sharing_mode: informationSharingModeSchema,
  allowed_purposes: z.array(z.string().min(1)).min(1).max(32),
  retention_until: z.string().datetime().nullable(),
  created_by: z.string().min(1),
  change_note: z.string().min(1).optional(),
}).strict();
export type ReclassifyInformationRequestDto = z.infer<typeof reclassifyInformationRequestSchema>;

export interface InformationPolicyRecord {
  resource_ref: string;
  version: number;
  owner_ref: string;
  domain: string;
  sensitivity: SensitivityLevelDto;
  sharing_mode: InformationSharingModeDto;
  allowed_purposes: string[];
  retention_until: string | null;
  created_by: string;
  change_note: string | null;
  created_at: string;
}

export const consentPermissionSchema = z.enum(['read', 'derive', 'disclose', 'act']);
export type ConsentPermissionDto = z.infer<typeof consentPermissionSchema>;

export const consentBasisSchema = z.enum(['explicit', 'contract', 'legal_obligation']);
export type ConsentBasisDto = z.infer<typeof consentBasisSchema>;

export const consentGrantStatusSchema = z.enum(['active', 'revoked']);
export type ConsentGrantStatusDto = z.infer<typeof consentGrantStatusSchema>;

export const createConsentGrantRequestSchema = z.object({
  grantor_ref: z.string().min(1),
  grantee_ref: z.string().min(1),
  resource_pattern: z.string().min(1),
  source_domain: z.string().min(1),
  target_domain: z.string().min(1),
  purpose: z.string().min(1),
  permissions: z.array(consentPermissionSchema).min(1).max(4),
  allowed_fields: z.array(z.string().min(1)).min(1).max(128),
  max_sensitivity: sensitivityLevelSchema,
  basis: consentBasisSchema,
  expires_at: z.string().datetime().nullable(),
  evidence_ref: z.string().min(1),
}).strict();
export type CreateConsentGrantRequestDto = z.infer<typeof createConsentGrantRequestSchema>;

export interface ConsentGrantRecord extends CreateConsentGrantRequestDto {
  id: string;
  status: ConsentGrantStatusDto;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
}

export const checkConsentRequestSchema = z.object({
  grantor_ref: z.string().min(1),
  grantee_ref: z.string().min(1),
  resource_ref: z.string().min(1),
  source_domain: z.string().min(1),
  target_domain: z.string().min(1),
  purpose: z.string().min(1),
  permission: consentPermissionSchema,
  requested_fields: z.array(z.string().min(1)).max(128),
  sensitivity: sensitivityLevelSchema,
}).strict();
export type CheckConsentRequestDto = z.infer<typeof checkConsentRequestSchema>;

export interface AuthorizationDecisionDto {
  allowed: boolean;
  reason: string;
  grant_id: string | null;
}

export const authorizeInformationProjectionRequestSchema = z.object({
  resource_ref: z.string().min(1),
  actor_ref: z.string().min(1),
  target_domain: z.string().min(1),
  purpose: z.string().min(1),
  permission: consentPermissionSchema,
  requested_fields: z.array(z.string().min(1)).max(128),
}).strict();
export type AuthorizeInformationProjectionRequestDto = z.infer<typeof authorizeInformationProjectionRequestSchema>;

export const actionKindSchema = z.enum([
  'communicate',
  'schedule',
  'disclose',
  'purchase',
  'subscribe',
  'cancel',
  'medical',
  'external_side_effect',
  'custom',
]);
export type ActionKindDto = z.infer<typeof actionKindSchema>;

export const actionIntentSchema = z.object({
  actor_ref: z.string().min(1),
  subject_ref: z.string().min(1),
  action_kind: actionKindSchema,
  reversibility: z.enum(['reversible', 'compensatable', 'irreversible']),
  recurrence: z.enum(['one_off', 'recurring']),
  amount: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  sensitive_disclosure: z.boolean(),
  health_impact: z.boolean(),
  third_party_effect: z.boolean(),
  new_counterparty: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict().superRefine((value, context) => {
  if ((value.amount === undefined) !== (value.currency === undefined)) {
    context.addIssue({ code: 'custom', message: 'amount and currency must be supplied together' });
  }
});
export type ActionIntentDto = z.infer<typeof actionIntentSchema>;

export const actionRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);
export type ActionRiskLevelDto = z.infer<typeof actionRiskLevelSchema>;

export const actionRiskDecisionSchema = z.enum(['allow', 'require_human_gate', 'deny']);
export type ActionRiskDecisionDto = z.infer<typeof actionRiskDecisionSchema>;

export interface ActionRiskAssessmentRecord {
  id: string;
  intent: ActionIntentDto;
  risk_level: ActionRiskLevelDto;
  decision: ActionRiskDecisionDto;
  reasons: string[];
  policy_version: string;
  created_at: string;
}

