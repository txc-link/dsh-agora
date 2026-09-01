import { randomUUID } from 'node:crypto';
import {
  createRoutineRequestSchema,
  type CreateRoutineRequestDto,
  type IRoutineRepository,
  type RoutineDto,
  type RoutineRunDto,
  type RoutineStatusDto,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError } from './errors.js';

export interface RoutineServiceOptions {
  repository: IRoutineRepository;
  now?: () => Date;
  leaseTokenGenerator?: () => string;
}

export class RoutineService {
  private readonly now: () => Date;
  private readonly leaseTokenGenerator: () => string;

  constructor(private readonly options: RoutineServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.leaseTokenGenerator = options.leaseTokenGenerator ?? randomUUID;
  }

  create(input: CreateRoutineRequestDto): RoutineDto {
    const parsed = createRoutineRequestSchema.parse(input);
    if (this.options.repository.getById(parsed.routine_id)) throw new ConflictError(`routine already exists: ${parsed.routine_id}`);
    const timestamp = this.now().toISOString();
    return this.options.repository.insert({
      ...parsed,
      status: 'active',
      next_run_at: new Date(parsed.first_run_at).toISOString(),
      last_run_at: null,
      created_at: timestamp,
      updated_at: timestamp,
    });
  }

  get(routineId: string): RoutineDto {
    const routine = this.options.repository.getById(routineId);
    if (!routine) throw new NotFoundError(`routine not found: ${routineId}`);
    return routine;
  }

  list(filters: { owner_ref?: string; agent_ref?: string; status?: RoutineStatusDto } = {}): RoutineDto[] {
    return this.options.repository.list(filters);
  }

  setStatus(routineId: string, status: RoutineStatusDto): RoutineDto {
    this.get(routineId);
    const updated = this.options.repository.updateStatus(routineId, status, this.now().toISOString());
    if (!updated) throw new ConflictError(`routine status update failed: ${routineId}`);
    return updated;
  }

  claimDue(input: { consumer_ref: string; limit?: number; lease_ms?: number }): RoutineRunDto[] {
    const now = this.now();
    return this.options.repository.claimDue({
      now: now.toISOString(), consumer_ref: input.consumer_ref,
      lease_expires_at: new Date(now.getTime() + (input.lease_ms ?? 120_000)).toISOString(),
      limit: Math.max(1, Math.min(20, input.limit ?? 5)), lease_token_factory: this.leaseTokenGenerator,
    });
  }

  markSucceeded(id: string, leaseToken: string, result: Record<string, unknown> | null = null): RoutineRunDto {
    const updated = this.options.repository.markSucceeded(id, leaseToken, this.now().toISOString(), result);
    if (!updated) throw new ConflictError(`routine run lease mismatch: ${id}`);
    return updated;
  }

  attachDispatch(id: string, leaseToken: string, dispatchId: string): RoutineRunDto {
    const updated = this.options.repository.attachDispatch(id, leaseToken, dispatchId, this.now().toISOString());
    if (!updated) throw new ConflictError(`routine run lease mismatch: ${id}`);
    return updated;
  }

  updateArtifact(id: string, artifactId: string): RoutineRunDto {
    const updated = this.options.repository.updateArtifact(id, artifactId, this.now().toISOString());
    if (!updated) throw new NotFoundError(`routine run not found: ${id}`);
    return updated;
  }

  updateDelivery(id: string, status: 'pending' | 'delivered' | 'failed' | 'skipped', error: string | null = null): RoutineRunDto {
    const updated = this.options.repository.updateDelivery(id, status, error, this.now().toISOString());
    if (!updated) throw new NotFoundError(`routine run not found: ${id}`);
    return updated;
  }

  markFailed(id: string, leaseToken: string, error: string): RoutineRunDto {
    const updated = this.options.repository.markFailed(id, leaseToken, error, this.now().toISOString());
    if (!updated) throw new ConflictError(`routine run lease mismatch: ${id}`);
    return updated;
  }

  reclaimExpired(limit = 20): number {
    return this.options.repository.reclaimExpired?.(this.now().toISOString(), this.now().toISOString(), limit) ?? 0;
  }

  listRuns(filters: { routine_id?: string; status?: RoutineRunDto['status']; delivery_status?: RoutineRunDto['delivery_status'] } = {}): RoutineRunDto[] {
    return this.options.repository.listRuns(filters);
  }
}
