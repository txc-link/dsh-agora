import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Command } from 'commander';
import type {
  ActionRiskService,
  ConsentService,
  InformationGovernanceService,
  RelationshipProfileService,
  RelationshipInitiativeService,
} from '@agora-ts/core';
import type {
  ActionIntentDto,
  ConsentBasisDto,
  ConsentPermissionDto,
  InformationSharingModeDto,
  RelationshipKindDto,
  RelationshipProfileStatusDto,
  SensitivityLevelDto,
  ScheduleRelationshipInitiativeRequestDto,
  RelationshipInitiativeStatusDto,
} from '@agora-ts/contracts';

interface OutputStream {
  write(chunk: string): unknown;
}

export interface RegisterPersonalGovernanceCommandsOptions {
  program: Command;
  stdout: OutputStream;
  relationshipService: () => RelationshipProfileService;
  initiativeService: () => RelationshipInitiativeService;
  informationService: () => InformationGovernanceService;
  consentService: () => ConsentService;
  actionRiskService: () => ActionRiskService;
}

function writeJson(stdout: OutputStream, value: unknown): void {
  stdout.write(`${JSON.stringify({ ok: true, data: value }, null, 2)}\n`);
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(path), 'utf8')) as T;
}

function commaList(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function registerPersonalGovernanceCommands(options: RegisterPersonalGovernanceCommandsOptions): void {
  const relationship = options.program.command('relationship').description('versioned owner-agent relationship profiles');
  relationship.command('create')
    .requiredOption('--profile <id>')
    .requiredOption('--owner <ref>')
    .requiredOption('--agent <ref>')
    .requiredOption('--kind <kind>', 'companion|friend|mentor|coach')
    .requiredOption('--name <displayName>')
    .requiredOption('--payload-file <path>', 'JSON persona/contract/initiative/voice payload')
    .requiredOption('--by <ref>')
    .option('--note <text>')
    .action((input: {
      profile: string; owner: string; agent: string; kind: RelationshipKindDto;
      name: string; payloadFile: string; by: string; note?: string;
    }) => writeJson(options.stdout, options.relationshipService().create({
      profile_id: input.profile,
      owner_ref: input.owner,
      agent_ref: input.agent,
      relationship_kind: input.kind,
      display_name: input.name,
      payload: readJsonFile(input.payloadFile),
      created_by: input.by,
      ...(input.note ? { change_note: input.note } : {}),
    })));

  relationship.command('revise')
    .requiredOption('--profile <id>')
    .requiredOption('--expected-version <n>', 'optimistic current version', Number.parseInt)
    .requiredOption('--payload-file <path>')
    .requiredOption('--by <ref>')
    .option('--note <text>')
    .action((input: { profile: string; expectedVersion: number; payloadFile: string; by: string; note?: string }) =>
      writeJson(options.stdout, options.relationshipService().revise({
        profile_id: input.profile,
        expected_current_version: input.expectedVersion,
        payload: readJsonFile(input.payloadFile),
        created_by: input.by,
        ...(input.note ? { change_note: input.note } : {}),
      })));

  relationship.command('show')
    .requiredOption('--profile <id>')
    .option('--version <n>', 'historical version', Number.parseInt)
    .action((input: { profile: string; version?: number }) =>
      writeJson(options.stdout, options.relationshipService().require(input.profile, input.version)));

  relationship.command('versions')
    .requiredOption('--profile <id>')
    .action((input: { profile: string }) =>
      writeJson(options.stdout, options.relationshipService().listVersions(input.profile)));

  relationship.command('list')
    .option('--owner <ref>')
    .option('--agent <ref>')
    .option('--status <status>', 'active|paused|archived')
    .action((input: { owner?: string; agent?: string; status?: RelationshipProfileStatusDto }) =>
      writeJson(options.stdout, options.relationshipService().list({
        ...(input.owner ? { owner_ref: input.owner } : {}),
        ...(input.agent ? { agent_ref: input.agent } : {}),
        ...(input.status ? { status: input.status } : {}),
      })));

  relationship.command('status')
    .requiredOption('--profile <id>')
    .requiredOption('--expected-version <n>', 'optimistic current version', Number.parseInt)
    .requiredOption('--status <status>', 'active|paused|archived')
    .action((input: { profile: string; expectedVersion: number; status: RelationshipProfileStatusDto }) =>
      writeJson(options.stdout, options.relationshipService().setStatus({
        profile_id: input.profile,
        expected_current_version: input.expectedVersion,
        status: input.status,
      })));

  const initiative = options.program.command('initiative').description('durable proactive relationship delivery outbox');
  initiative.command('schedule')
    .requiredOption('--input-file <path>', 'JSON schedule relationship initiative request')
    .action((input: { inputFile: string }) => writeJson(
      options.stdout,
      options.initiativeService().schedule(readJsonFile<ScheduleRelationshipInitiativeRequestDto>(input.inputFile)),
    ));

  initiative.command('list')
    .option('--profile <id>')
    .option('--target-domain <domain>')
    .option('--status <status>', 'scheduled|claimed|delivered|failed|cancelled')
    .action((input: { profile?: string; targetDomain?: string; status?: RelationshipInitiativeStatusDto }) =>
      writeJson(options.stdout, options.initiativeService().list({
        ...(input.profile ? { profile_id: input.profile } : {}),
        ...(input.targetDomain ? { target_domain: input.targetDomain } : {}),
        ...(input.status ? { status: input.status } : {}),
      })));

  const information = options.program.command('information').description('information classification and projection authorization');
  information.command('classify')
    .requiredOption('--resource <ref>')
    .requiredOption('--owner <ref>')
    .requiredOption('--domain <domain>')
    .requiredOption('--sensitivity <level>')
    .requiredOption('--sharing <mode>')
    .requiredOption('--purposes <csv>')
    .requiredOption('--by <ref>')
    .option('--retention-until <iso>')
    .option('--note <text>')
    .action((input: {
      resource: string; owner: string; domain: string; sensitivity: SensitivityLevelDto;
      sharing: InformationSharingModeDto; purposes: string; by: string; retentionUntil?: string; note?: string;
    }) => writeJson(options.stdout, options.informationService().classify({
      resource_ref: input.resource,
      owner_ref: input.owner,
      domain: input.domain,
      sensitivity: input.sensitivity,
      sharing_mode: input.sharing,
      allowed_purposes: commaList(input.purposes),
      retention_until: input.retentionUntil ?? null,
      created_by: input.by,
      ...(input.note ? { change_note: input.note } : {}),
    })));

  information.command('reclassify')
    .requiredOption('--resource <ref>')
    .requiredOption('--expected-version <n>', 'optimistic current version', Number.parseInt)
    .requiredOption('--sensitivity <level>')
    .requiredOption('--sharing <mode>')
    .requiredOption('--purposes <csv>')
    .requiredOption('--by <ref>')
    .option('--domain <domain>')
    .option('--retention-until <iso>')
    .option('--note <text>')
    .action((input: {
      resource: string; expectedVersion: number; domain?: string; sensitivity: SensitivityLevelDto;
      sharing: InformationSharingModeDto; purposes: string; by: string; retentionUntil?: string; note?: string;
    }) => writeJson(options.stdout, options.informationService().reclassify({
      resource_ref: input.resource,
      expected_current_version: input.expectedVersion,
      ...(input.domain ? { domain: input.domain } : {}),
      sensitivity: input.sensitivity,
      sharing_mode: input.sharing,
      allowed_purposes: commaList(input.purposes),
      retention_until: input.retentionUntil ?? null,
      created_by: input.by,
      ...(input.note ? { change_note: input.note } : {}),
    })));

  information.command('show')
    .requiredOption('--resource <ref>')
    .option('--version <n>', 'historical version', Number.parseInt)
    .action((input: { resource: string; version?: number }) =>
      writeJson(options.stdout, options.informationService().require(input.resource, input.version)));

  information.command('list')
    .option('--domain <domain>')
    .action((input: { domain?: string }) => writeJson(options.stdout, options.informationService().list(input.domain)));

  information.command('authorize')
    .requiredOption('--resource <ref>')
    .requiredOption('--actor <ref>')
    .requiredOption('--target-domain <domain>')
    .requiredOption('--purpose <purpose>')
    .requiredOption('--permission <permission>', 'read|derive|disclose|act')
    .requiredOption('--fields <csv>')
    .action((input: {
      resource: string; actor: string; targetDomain: string; purpose: string;
      permission: ConsentPermissionDto; fields: string;
    }) => writeJson(options.stdout, options.informationService().authorizeProjection({
      resource_ref: input.resource,
      actor_ref: input.actor,
      target_domain: input.targetDomain,
      purpose: input.purpose,
      permission: input.permission,
      requested_fields: commaList(input.fields),
    })));

  const consent = options.program.command('consent').description('explicit purpose-bound consent grants');
  consent.command('grant')
    .requiredOption('--grantor <ref>')
    .requiredOption('--grantee <ref>')
    .requiredOption('--resource-pattern <pattern>')
    .requiredOption('--source-domain <domain>')
    .requiredOption('--target-domain <domain>')
    .requiredOption('--purpose <purpose>')
    .requiredOption('--permissions <csv>')
    .requiredOption('--fields <csv>')
    .requiredOption('--max-sensitivity <level>')
    .requiredOption('--basis <basis>', 'explicit|contract|legal_obligation')
    .requiredOption('--evidence <ref>')
    .option('--expires-at <iso>')
    .action((input: {
      grantor: string; grantee: string; resourcePattern: string; sourceDomain: string; targetDomain: string;
      purpose: string; permissions: string; fields: string; maxSensitivity: SensitivityLevelDto;
      basis: ConsentBasisDto; evidence: string; expiresAt?: string;
    }) => writeJson(options.stdout, options.consentService().grant({
      grantor_ref: input.grantor,
      grantee_ref: input.grantee,
      resource_pattern: input.resourcePattern,
      source_domain: input.sourceDomain,
      target_domain: input.targetDomain,
      purpose: input.purpose,
      permissions: commaList(input.permissions) as ConsentPermissionDto[],
      allowed_fields: commaList(input.fields),
      max_sensitivity: input.maxSensitivity,
      basis: input.basis,
      expires_at: input.expiresAt ?? null,
      evidence_ref: input.evidence,
    })));

  consent.command('revoke')
    .requiredOption('--id <grantId>')
    .requiredOption('--by <ref>')
    .action((input: { id: string; by: string }) =>
      writeJson(options.stdout, options.consentService().revoke({ grant_id: input.id, revoked_by: input.by })));

  consent.command('list')
    .option('--grantor <ref>')
    .option('--grantee <ref>')
    .option('--status <status>', 'active|revoked')
    .action((input: { grantor?: string; grantee?: string; status?: 'active' | 'revoked' }) =>
      writeJson(options.stdout, options.consentService().list({
        ...(input.grantor ? { grantor_ref: input.grantor } : {}),
        ...(input.grantee ? { grantee_ref: input.grantee } : {}),
        ...(input.status ? { status: input.status } : {}),
      })));

  const risk = options.program.command('risk').description('assess action intent before side effects');
  risk.command('assess')
    .requiredOption('--intent-file <path>', 'JSON action intent')
    .action((input: { intentFile: string }) =>
      writeJson(options.stdout, options.actionRiskService().assess(readJsonFile<ActionIntentDto>(input.intentFile))));
}
