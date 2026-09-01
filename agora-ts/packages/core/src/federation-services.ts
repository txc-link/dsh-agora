import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  type ArtifactDto, type CreateArtifactRequestDto, type CreateMemoryEntryRequestDto, type ReviewArtifactRequestDto,
  type CreateMergeProposalRequestDto, type IssuedRuntimeNodeCredentialDto, type MemoryEntryDto,
  type MemoryQueryDto, type MergeProposalDto, type RuntimeNodeCredentialDto, type RuntimeNodeCredentialScopeDto,
} from '@agora-ts/contracts';
import { ConflictError, NotFoundError, PermissionDeniedError } from './errors.js';

export interface ArtifactContentStorePort { put(sha256: string, bytes: Buffer): string; get(contentUri: string): Buffer; }
export interface FederationRepositoryPort {
  createArtifact(input: Omit<CreateArtifactRequestDto, 'content_base64'> & { sha256: string; size_bytes: number; content_uri: string }, now?: Date): ArtifactDto;
  getArtifact(id: string): ArtifactDto | null; listArtifacts(ownerKind?: string, ownerRef?: string, limit?: number): ArtifactDto[];
  updateArtifactMetadata(id: string, metadata: Record<string, unknown> | null): ArtifactDto | null;
  createMemory(input: CreateMemoryEntryRequestDto, now?: Date): MemoryEntryDto; getMemory(id: string, now?: Date): MemoryEntryDto | null;
  queryMemory(input: MemoryQueryDto, now?: Date): MemoryEntryDto[];
  createNodeCredential(input: { node_id: string; token_hash: string; scopes: RuntimeNodeCredentialScopeDto[]; label: string | null; expires_at: string | null }, now?: Date): RuntimeNodeCredentialDto;
  getNodeCredential(id: string): RuntimeNodeCredentialDto | null;
  findNodeCredentialByHash(tokenHash: string): (RuntimeNodeCredentialDto & { token_hash: string }) | null;
  listNodeCredentials(nodeId: string): RuntimeNodeCredentialDto[]; touchNodeCredential(id: string, now?: Date): void;
  transitionNodeCredential(id: string, status: 'revoked' | 'rotated', now?: Date): RuntimeNodeCredentialDto | null;
  createMergeProposal(input: CreateMergeProposalRequestDto, now?: Date): MergeProposalDto; getMergeProposal(id: string): MergeProposalDto | null;
  listMergeProposals(projectId?: string, limit?: number): MergeProposalDto[];
  updateMergeProposal(id: string, patch: { status: MergeProposalDto['status']; approved_by?: string | null; decision_reason?: string | null;
    merge_commit?: string | null; error?: string | null; decided_at?: string | null; merged_at?: string | null }, now?: Date): MergeProposalDto;
}

export class ArtifactService {
  constructor(private readonly repository: FederationRepositoryPort, private readonly store: ArtifactContentStorePort) {}
  create(input: CreateArtifactRequestDto): ArtifactDto {
    const bytes = Buffer.from(input.content_base64, 'base64');
    if (bytes.length === 0 || bytes.toString('base64').replace(/=+$/u, '') !== input.content_base64.replace(/=+$/u, '')) throw new TypeError('content_base64 is not canonical base64');
    if (bytes.length > 5_000_000) throw new TypeError('artifact content exceeds 5 MB');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const metadata = input.media_type.startsWith('text/markdown') && input.metadata?.version === undefined
      ? { ...(input.metadata ?? {}), version: 1, review_status: 'draft' }
      : input.metadata ?? null;
    return this.repository.createArtifact({ name: input.name, kind: input.kind, media_type: input.media_type,
      owner_kind: input.owner_kind, owner_ref: input.owner_ref, metadata,
      sha256, size_bytes: bytes.length, content_uri: this.store.put(sha256, bytes) });
  }
  get(id: string): ArtifactDto { const value = this.repository.getArtifact(id); if (!value) throw new NotFoundError(`Artifact ${id} not found`); return value; }
  content(id: string): Buffer {
    const artifact = this.get(id); const bytes = this.store.get(artifact.content_uri);
    if (createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) throw new Error(`Artifact ${id} failed SHA-256 verification`);
    return bytes;
  }
  list(ownerKind?: string, ownerRef?: string, limit?: number): ArtifactDto[] { return this.repository.listArtifacts(ownerKind, ownerRef, limit); }
  createVersion(parentArtifactId: string, content: string): ArtifactDto {
    const parent = this.get(parentArtifactId);
    if (!parent.media_type.startsWith('text/markdown')) throw new ConflictError(`artifact ${parentArtifactId} is not markdown`);
    const parentVersion = metadataNumber(parent.metadata, 'version') ?? 1;
    const previousContent = this.content(parentArtifactId).toString('utf8');
    return this.create({
      name: parent.name, kind: parent.kind, media_type: 'text/markdown',
      content_base64: Buffer.from(content, 'utf8').toString('base64'),
      owner_kind: parent.owner_kind, owner_ref: parent.owner_ref,
      metadata: {
        ...(parent.metadata ?? {}), parent_artifact_id: parent.id, version: parentVersion + 1, review_status: 'draft',
        diff_base_sha256: parent.sha256, diff_kind: previousContent === content ? 'unchanged' : 'modified',
        diff_changed_bytes: Math.abs(Buffer.byteLength(content, 'utf8') - Buffer.byteLength(previousContent, 'utf8')),
      },
    });
  }
  review(id: string, input: ReviewArtifactRequestDto): ArtifactDto {
    const artifact = this.get(id);
    const updated = this.repository.updateArtifactMetadata(id, {
      ...(artifact.metadata ?? {}), review_status: input.status, reviewed_by: input.reviewed_by,
      reviewed_at: new Date().toISOString(), review_comment: input.comment ?? null,
    });
    if (!updated) throw new NotFoundError(`Artifact ${id} not found`);
    return updated;
  }
}

function metadataNumber(metadata: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

export class MemoryService {
  constructor(private readonly repository: FederationRepositoryPort) {}
  create(input: CreateMemoryEntryRequestDto): MemoryEntryDto { return this.repository.createMemory(input); }
  get(id: string): MemoryEntryDto { const value = this.repository.getMemory(id); if (!value) throw new NotFoundError(`Memory ${id} not found`); return value; }
  query(input: MemoryQueryDto): MemoryEntryDto[] { return this.repository.queryMemory(input); }
}

export class RuntimeNodeCredentialService {
  constructor(private readonly repository: FederationRepositoryPort, private readonly now: () => Date = () => new Date()) {}
  issue(nodeId: string, input: { scopes: RuntimeNodeCredentialScopeDto[]; expires_in_seconds?: number | null; label?: string | null }): IssuedRuntimeNodeCredentialDto {
    const token = `agora_node_${randomBytes(32).toString('base64url')}`; const now = this.now();
    const credential = this.repository.createNodeCredential({ node_id: nodeId, token_hash: hashToken(token),
      scopes: [...new Set(input.scopes)].sort() as RuntimeNodeCredentialScopeDto[], label: input.label ?? null,
      expires_at: input.expires_in_seconds ? new Date(now.getTime() + input.expires_in_seconds * 1_000).toISOString() : null }, now);
    return { credential, token };
  }
  authenticate(nodeId: string, token: string, scope: RuntimeNodeCredentialScopeDto): boolean {
    const credential = this.repository.findNodeCredentialByHash(hashToken(token));
    if (!credential || credential.node_id !== nodeId || credential.status !== 'active' || !credential.scopes.includes(scope)) return false;
    if (credential.expires_at && new Date(credential.expires_at).getTime() <= this.now().getTime()) return false;
    this.repository.touchNodeCredential(credential.id, this.now()); return true;
  }
  list(nodeId: string): RuntimeNodeCredentialDto[] { return this.repository.listNodeCredentials(nodeId); }
  rotate(nodeId: string, id: string): IssuedRuntimeNodeCredentialDto {
    const current = this.repository.getNodeCredential(id);
    if (!current || current.node_id !== nodeId) throw new NotFoundError(`Runtime node credential ${id} not found`);
    if (current.status !== 'active') throw new ConflictError(`Runtime node credential ${id} is not active`);
    this.repository.transitionNodeCredential(id, 'rotated', this.now());
    const remaining = current.expires_at ? Math.max(60, Math.floor((new Date(current.expires_at).getTime() - this.now().getTime()) / 1_000)) : null;
    return this.issue(nodeId, { scopes: current.scopes, expires_in_seconds: remaining, label: current.label });
  }
  revoke(nodeId: string, id: string): RuntimeNodeCredentialDto {
    const current = this.repository.getNodeCredential(id);
    if (!current || current.node_id !== nodeId) throw new NotFoundError(`Runtime node credential ${id} not found`);
    return this.repository.transitionNodeCredential(id, 'revoked', this.now())!;
  }
}

type ExecFileLike = (command: string, args: string[], options?: { cwd?: string }) => string;
export class MergeCoordinatorService {
  private readonly execFile: ExecFileLike;
  constructor(private readonly repository: FederationRepositoryPort, private readonly artifacts: Pick<ArtifactService, 'get' | 'content'>,
    private readonly resolveProjectRepoPath: (projectId: string) => string | null, execFile?: ExecFileLike) {
    this.execFile = execFile ?? ((command, args, options) => execFileSync(command, args, { cwd: options?.cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim());
  }
  create(input: CreateMergeProposalRequestDto): MergeProposalDto {
    const repoPath = this.requireProjectRepo(input.project_id); const worktree = resolve(input.worktree_path);
    const registered = this.execFile('git', ['-C', repoPath, 'worktree', 'list', '--porcelain']);
    if (!registered.split(/\r?\n/u).some(line => line === `worktree ${worktree}`)) throw new PermissionDeniedError('worktree_path is not registered under the project repository');
    if (this.execFile('git', ['-C', repoPath, 'rev-parse', 'HEAD']) !== input.base_revision
      || this.execFile('git', ['-C', worktree, 'rev-parse', 'HEAD']) !== input.head_revision) throw new ConflictError('merge proposal revisions do not match current repositories');
    this.validateArtifacts(input.validation_artifact_ids);
    return this.repository.createMergeProposal({ ...input, worktree_path: worktree });
  }
  get(id: string): MergeProposalDto { const value = this.repository.getMergeProposal(id); if (!value) throw new NotFoundError(`Merge proposal ${id} not found`); return value; }
  list(projectId?: string, limit?: number): MergeProposalDto[] { return this.repository.listMergeProposals(projectId, limit); }
  decide(id: string, actorId: string, decision: 'approve' | 'reject', reason: string): MergeProposalDto {
    const proposal = this.get(id); if (proposal.status !== 'proposed') throw new ConflictError(`Merge proposal ${id} is not awaiting a decision`);
    return this.repository.updateMergeProposal(id, { status: decision === 'approve' ? 'approved' : 'rejected', approved_by: actorId,
      decision_reason: reason, decided_at: new Date().toISOString() });
  }
  execute(id: string): MergeProposalDto {
    const proposal = this.get(id); if (proposal.status !== 'approved' || !proposal.approved_by) throw new PermissionDeniedError('merge proposal requires authenticated human approval');
    const repoPath = this.requireProjectRepo(proposal.project_id);
    if (this.execFile('git', ['-C', repoPath, 'status', '--porcelain']) !== '') throw new ConflictError('project repository is not clean');
    if (this.execFile('git', ['-C', repoPath, 'rev-parse', 'HEAD']) !== proposal.base_revision) throw new ConflictError('project base revision drifted after approval');
    if (this.execFile('git', ['-C', proposal.worktree_path, 'rev-parse', 'HEAD']) !== proposal.head_revision) throw new ConflictError('sandbox head revision drifted after approval');
    this.validateArtifacts(proposal.validation_artifact_ids);
    this.repository.updateMergeProposal(id, { status: 'merging' });
    try {
      this.execFile('git', ['-C', repoPath, 'merge', '--no-ff', '--no-edit', proposal.head_revision]);
      return this.repository.updateMergeProposal(id, { status: 'merged', merge_commit: this.execFile('git', ['-C', repoPath, 'rev-parse', 'HEAD']), merged_at: new Date().toISOString(), error: null });
    } catch (error) {
      try { this.execFile('git', ['-C', repoPath, 'merge', '--abort']); } catch { /* no merge state */ }
      return this.repository.updateMergeProposal(id, { status: 'conflicted', error: error instanceof Error ? error.message : String(error) });
    }
  }
  private validateArtifacts(artifactIds: string[]): void {
    for (const artifactId of artifactIds) {
      const artifact = this.artifacts.get(artifactId);
      if (artifact.kind !== 'validation') throw new TypeError(`Artifact ${artifactId} is not a validation artifact`);
      this.artifacts.content(artifactId);
    }
  }
  private requireProjectRepo(projectId: string): string { const value = this.resolveProjectRepoPath(projectId); if (!value) throw new NotFoundError(`Project ${projectId} has no repository`); return resolve(value); }
}
function hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
