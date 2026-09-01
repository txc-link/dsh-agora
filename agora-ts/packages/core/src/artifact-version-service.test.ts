import { describe, expect, it, vi } from 'vitest';
import type { ArtifactDto } from '@agora-ts/contracts';
import { ArtifactService } from './federation-services.js';

const root: ArtifactDto = {
  id: 'artifact-1', name: 'plan.md', kind: 'deliverable', media_type: 'text/markdown',
  sha256: '230d8358dc8e8890b4c58deeb62912ee2f20357ae92a5cc861b98e68fe31acb5', size_bytes: 4, content_uri: 'artifact://a', owner_kind: 'task', owner_ref: 'task-1',
  metadata: { version: 1, review_status: 'approved' }, created_at: '2026-09-01T00:00:00.000Z',
};

describe('ArtifactService document versions', () => {
  it('creates a linked draft version and persists review metadata', () => {
    const created: ArtifactDto = { ...root, id: 'artifact-2', sha256: 'b'.repeat(64), size_bytes: 7, content_uri: 'artifact://b', metadata: { version: 2, parent_artifact_id: 'artifact-1', review_status: 'draft' } };
    const repository = {
      getArtifact: vi.fn((id: string) => id === 'artifact-1' ? root : created),
      createArtifact: vi.fn(() => created),
      updateArtifactMetadata: vi.fn((_id: string, metadata: Record<string, unknown>) => ({ ...created, metadata })),
    };
    const store = { put: vi.fn(() => 'artifact://b'), get: vi.fn(() => Buffer.from('body')) };
    const service = new ArtifactService(repository as never, store as never);
    expect(service.createVersion('artifact-1', 'updated').metadata).toMatchObject({ version: 2, parent_artifact_id: 'artifact-1' });
    expect(service.review('artifact-2', { status: 'approved', reviewed_by: 'human:ceo', comment: 'ok' }).metadata).toMatchObject({ review_status: 'approved', reviewed_by: 'human:ceo' });
  });
});
