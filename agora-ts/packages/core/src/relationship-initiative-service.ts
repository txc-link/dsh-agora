import { randomUUID } from 'node:crypto';
import {
  scheduleRelationshipInitiativeRequestSchema,
  type IRelationshipInitiativeRepository,
  type IRelationshipProfileRepository,
  type RelationshipInitiativeRecord,
  type RelationshipInitiativeStatusDto,
  type ScheduleRelationshipInitiativeRequestDto,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError, PermissionDeniedError } from './errors.js';

export interface RelationshipInitiativeServiceOptions {
  initiativeRepository: IRelationshipInitiativeRepository;
  relationshipRepository: IRelationshipProfileRepository;
  now?: () => Date;
  idGenerator?: () => string;
  leaseTokenGenerator?: () => string;
}

export class RelationshipInitiativeService {
  private readonly now: () => Date;
  private readonly idGenerator: () => string;
  private readonly leaseTokenGenerator: () => string;

  public constructor(private readonly options: RelationshipInitiativeServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.idGenerator = options.idGenerator ?? randomUUID;
    this.leaseTokenGenerator = options.leaseTokenGenerator ?? randomUUID;
  }

  public schedule(input: ScheduleRelationshipInitiativeRequestDto): RelationshipInitiativeRecord {
    const parsed = scheduleRelationshipInitiativeRequestSchema.parse(input);
    const snapshot = this.options.relationshipRepository.getById(parsed.profile_id);
    if (!snapshot) throw new NotFoundError(`relationship profile not found: ${parsed.profile_id}`);
    if (snapshot.profile.status !== 'active') {
      throw new PermissionDeniedError(`relationship profile is not active: ${parsed.profile_id}`);
    }
    const policy = snapshot.version.payload.initiative_policy;
    if (!policy.enabled) throw new PermissionDeniedError('relationship initiative policy is disabled');
    if (!policy.allowed_triggers.includes(parsed.trigger)) {
      throw new PermissionDeniedError(`relationship initiative trigger is not allowed: ${parsed.trigger}`);
    }
    const scheduled = new Date(parsed.scheduled_for);
    const timezone = policy.quiet_hours?.timezone ?? 'UTC';
    const local = localParts(scheduled, timezone);
    if (policy.quiet_hours && isQuietMinute(local.minutes, policy.quiet_hours.start, policy.quiet_hours.end)) {
      throw new PermissionDeniedError('relationship initiative falls inside quiet hours');
    }
    if (this.options.initiativeRepository.countForLocalDate(parsed.profile_id, local.date)
      >= policy.max_daily_initiatives) {
      throw new ConflictError('relationship initiative daily limit reached');
    }
    const timestamp = this.now().toISOString();
    return this.options.initiativeRepository.insert({
      id: this.idGenerator(),
      profile_id: parsed.profile_id,
      profile_version: snapshot.profile.current_version,
      owner_ref: snapshot.profile.owner_ref,
      agent_ref: snapshot.profile.agent_ref,
      trigger: parsed.trigger,
      modality: parsed.modality,
      text: parsed.text,
      resource_ref: parsed.resource_ref,
      source_domain: parsed.source_domain,
      target_domain: parsed.target_domain,
      delivery_binding_ref: parsed.delivery_binding_ref,
      purpose: parsed.purpose,
      requested_fields: parsed.requested_fields,
      scheduled_for: scheduled.toISOString(),
      schedule_local_date: local.date,
      status: 'scheduled',
      consumer_ref: null,
      lease_token: null,
      lease_expires_at: null,
      attempt_count: 0,
      last_error: null,
      delivered_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  public claimDue(input: { consumer_ref: string; target_domain: string; limit?: number; lease_ms?: number }) {
    const now = this.now();
    return this.options.initiativeRepository.claimDue({
      consumer_ref: input.consumer_ref,
      target_domain: input.target_domain,
      now: now.toISOString(),
      lease_expires_at: new Date(now.getTime() + (input.lease_ms ?? 60_000)).toISOString(),
      limit: Math.max(1, Math.min(20, input.limit ?? 5)),
      lease_token_factory: this.leaseTokenGenerator,
    });
  }

  public markDelivered(id: string, leaseToken: string) {
    const updated = this.options.initiativeRepository.markDelivered(id, leaseToken, this.now().toISOString());
    if (!updated) throw new ConflictError(`relationship initiative lease mismatch: ${id}`);
    return updated;
  }

  public markFailed(id: string, leaseToken: string, error: string) {
    const updated = this.options.initiativeRepository.markFailed(id, leaseToken, error, this.now().toISOString());
    if (!updated) throw new ConflictError(`relationship initiative lease mismatch: ${id}`);
    return updated;
  }

  public list(filters: { profile_id?: string; target_domain?: string; status?: RelationshipInitiativeStatusDto } = {}) {
    return this.options.initiativeRepository.list(filters);
  }
}

function localParts(date: Date, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    minutes: Number(value('hour')) * 60 + Number(value('minute')),
  };
}

function isQuietMinute(minutes: number, start: string, end: string): boolean {
  const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from === to) return true;
  return from < to ? minutes >= from && minutes < to : minutes >= from || minutes < to;
}

