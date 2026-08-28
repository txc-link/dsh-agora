import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations, FederationRepository, type AgoraDatabase } from '@agora-ts/db';
import { ArtifactService, MemoryService, MergeCoordinatorService, RuntimeNodeCredentialService } from './federation-services.js';

const databases: AgoraDatabase[] = [];
const tempPaths: string[] = [];

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close();
  while (tempPaths.length > 0) rmSync(tempPaths.pop()!, { recursive: true, force: true });
});

describe('federation services', () => {
  it('stores artifacts by content hash and rejects tampering on read', () => {
    const { repository } = setup();
    const root = mkdtempSync(join(tmpdir(), 'agora-artifacts-'));
    tempPaths.push(root);
    const store = {
      put(sha256: string, bytes: Buffer) {
        const target = join(root, sha256.slice(0, 2), sha256.slice(2));
        mkdirSync(join(root, sha256.slice(0, 2)), { recursive: true });
        writeFileSync(target, bytes);
        return `sha256:${sha256}`;
      },
      get(contentUri: string) {
        const sha256 = contentUri.slice('sha256:'.length);
        return readFileSync(join(root, sha256.slice(0, 2), sha256.slice(2)));
      },
    };
    const service = new ArtifactService(repository, store);
    const artifact = service.create({
      name: 'validation.json', kind: 'validation', media_type: 'application/json',
      content_base64: Buffer.from('{"ok":true}').toString('base64'), owner_kind: 'coordination_run', owner_ref: 'run-1',
    });

    expect(service.content(artifact.id).toString()).toBe('{"ok":true}');
    writeFileSync(join(root, artifact.sha256.slice(0, 2), artifact.sha256.slice(2)), 'tampered', 'utf8');
    expect(() => service.content(artifact.id)).toThrow(/SHA-256/u);
  });

  it('enforces scoped node credentials across rotate and revoke', () => {
    const { repository } = setup();
    const clock = { now: new Date('2026-08-28T00:00:00.000Z') };
    const service = new RuntimeNodeCredentialService(repository, () => clock.now);
    const issued = service.issue('web-1', { scopes: ['heartbeat', 'dispatch'], expires_in_seconds: 120, label: 'worker' });

    expect(service.authenticate('web-1', issued.token, 'dispatch')).toBe(true);
    expect(service.authenticate('web-1', issued.token, 'delivery')).toBe(false);
    const rotated = service.rotate('web-1', issued.credential.id);
    expect(service.authenticate('web-1', issued.token, 'dispatch')).toBe(false);
    expect(service.authenticate('web-1', rotated.token, 'dispatch')).toBe(true);
    service.revoke('web-1', rotated.credential.id);
    expect(service.authenticate('web-1', rotated.token, 'heartbeat')).toBe(false);
  });

  it('keeps private, task, and project memory layers independently addressable', () => {
    const { repository } = setup();
    const service = new MemoryService(repository);
    service.create({ scope: 'agent_private', content: 'private-alpha', owner_ref: 'alpha', agent_ref: 'dsh:web:alpha', visibility: 'private', source: { kind: 'agent' }, artifact_ids: [], evidence_ids: [] });
    service.create({ scope: 'project_shared', content: 'project-rule', owner_ref: 'human', project_id: 'project-1', visibility: 'project', source: { kind: 'human' }, artifact_ids: [], evidence_ids: [] });

    expect(service.query({ scopes: ['agent_private'], agent_ref: 'dsh:web:alpha', limit: 20 }).map(item => item.content)).toEqual(['private-alpha']);
    expect(service.query({ scopes: ['agent_private'], agent_ref: 'dsh:web:beta', limit: 20 })).toEqual([]);
    expect(service.query({ scopes: ['project_shared'], project_id: 'project-1', limit: 20 }).map(item => item.content)).toEqual(['project-rule']);
    expect(service.query({ scopes: ['agent_private', 'project_shared'], agent_ref: 'dsh:web:alpha', project_id: 'project-1', limit: 20 })
      .map(item => item.content).sort()).toEqual(['private-alpha', 'project-rule']);
  });

  it('pins merge revisions and executes only after an explicit human decision', () => {
    const { repository, db } = setup();
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO tasks (id, title, type, creator, team, workflow, created_at, updated_at, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('task-1', 'Merge task', 'coding', 'human', '{}', '{}', now, now, 'project-1');
    const repoPath = resolve('repository');
    const worktreePath = resolve('sandbox-worktree');
    let repoRevisionReads = 0;
    const exec = (_command: string, args: string[]): string => {
      if (args[2] === 'worktree') return `worktree ${worktreePath}\nHEAD head-revision\nbranch refs/heads/feature`;
      if (args[2] === 'status') return '';
      if (args[2] === 'merge') return 'merged';
      if (args[2] === 'rev-parse' && args[1] === repoPath) {
        repoRevisionReads += 1;
        return repoRevisionReads < 3 ? 'base-revision' : 'merge-revision';
      }
      if (args[2] === 'rev-parse' && args[1] === worktreePath) return 'head-revision';
      throw new Error(`unexpected git arguments: ${args.join(' ')}`);
    };
    let validationReads = 0;
    const service = new MergeCoordinatorService(
      repository,
      {
        get: (id: string) => ({ id, kind: 'validation' }),
        content: () => { validationReads += 1; return Buffer.from('{"ok":true}'); },
      } as never,
      projectId => projectId === 'project-1' ? repoPath : null,
      exec,
    );
    const proposal = service.create({
      task_id: 'task-1', project_id: 'project-1', base_revision: 'base-revision', head_revision: 'head-revision',
      worktree_path: worktreePath, diff_summary: 'validated feature', validation_artifact_ids: ['artifact-1'], requested_by: 'agent-1',
    });

    expect(() => service.execute(proposal.id)).toThrow(/human approval/u);
    expect(service.decide(proposal.id, 'dashboard-admin', 'approve', 'validation passed').status).toBe('approved');
    expect(service.execute(proposal.id)).toMatchObject({ status: 'merged', merge_commit: 'merge-revision', approved_by: 'dashboard-admin' });
    expect(validationReads).toBe(2);
  });
});

function setup(): { repository: FederationRepository; db: AgoraDatabase } {
  const db = createAgoraDatabase({ dbPath: ':memory:' });
  databases.push(db);
  runMigrations(db);
  db.prepare(`INSERT INTO projects (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`)
    .run('project-1', 'Project One', new Date().toISOString(), new Date().toISOString());
  return { repository: new FederationRepository(db), db };
}
