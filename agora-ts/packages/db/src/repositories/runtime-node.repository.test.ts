import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createAgoraDatabase, runMigrations, type AgoraDatabase } from '../database.js';
import { RuntimeNodeRepository } from './runtime-node.repository.js';

const tempPaths: string[] = [];
const databases: AgoraDatabase[] = [];

function makeDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'agora-ts-runtime-node-repository-'));
  tempPaths.push(dir);
  return join(dir, 'tasks.db');
}

afterEach(() => {
  while (databases.length > 0) databases.pop()?.close();
  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('runtime node repository', () => {
  it('persists heartbeats and marks an expired lease stale', () => {
    const db = createAgoraDatabase({ dbPath: makeDbPath() });
    databases.push(db);
    runMigrations(db);
    const repository = new RuntimeNodeRepository(db);
    const now = new Date('2026-08-26T01:00:00.000Z');

    const node = repository.upsertNode('web-1', {
      protocol: 'dsh-agora.node/v1',
      instance_id: 'instance-1',
      plugin_version: '0.2.0',
      host_framework: 'deepseek-harness',
      runtime_provider: 'dsh',
      agents: [{
        agent_ref: 'default',
        display_name: 'Default agent',
        roles: ['worker'],
        capabilities: ['session.resume'],
      }],
      bots: [{
        provider: 'discord',
        bot_ref: 'discord-main',
        platform_id: '1234',
        agent_ref: 'default',
        connected: true,
        capabilities: ['send'],
      }],
      capacity: { max_concurrent: 2, active: 0 },
      lease_seconds: 90,
    }, now);

    expect(node.presence).toBe('online');
    expect(repository.getNode('web-1', new Date('2026-08-26T01:01:31.000Z'))).toMatchObject({
      node_id: 'web-1',
      presence: 'stale',
    });
  });

  it('claims and completes dispatches idempotently', () => {
    const db = createAgoraDatabase({ dbPath: makeDbPath() });
    databases.push(db);
    runMigrations(db);
    const repository = new RuntimeNodeRepository(db);
    repository.upsertNode('web-1', {
      protocol: 'dsh-agora.node/v1',
      instance_id: 'instance-1',
      plugin_version: '0.2.0',
      host_framework: 'deepseek-harness',
      runtime_provider: 'dsh',
      agents: [{ agent_ref: 'default', roles: [], capabilities: [] }],
      bots: [],
      capacity: { max_concurrent: 1, active: 0 },
      lease_seconds: 90,
    });
    const input = {
      runtime_target_ref: 'dsh:web-1:default',
      prompt: 'Review the current task.',
      idempotency_key: 'task-1-review-1',
    };

    const created = repository.createDispatch('web-1', input);
    const replayed = repository.createDispatch('web-1', input);
    expect(replayed.id).toBe(created.id);

    const claimedAt = new Date('2026-08-26T01:00:00.000Z');
    const claimed = repository.claimDispatch('web-1', 'instance-1', 120, claimedAt);
    expect(claimed).toMatchObject({
      id: created.id,
      status: 'claimed',
      claimed_by: 'instance-1',
      attempt: 1,
      claimed_at: claimedAt.toISOString(),
      claim_renewed_at: claimedAt.toISOString(),
    });
    expect(claimed?.claim_token).toEqual(expect.any(String));
    expect(repository.claimDispatch('web-1', 'instance-2', 120, claimedAt)).toBeNull();

    const renewedAt = new Date('2026-08-26T01:01:00.000Z');
    const renewed = repository.renewDispatch(
      'web-1',
      created.id,
      { instance_id: 'instance-1', claim_token: claimed!.claim_token!, lease_seconds: 120 },
      renewedAt,
    );
    expect(renewed).toMatchObject({
      claim_expires_at: '2026-08-26T01:03:00.000Z',
      claim_renewed_at: renewedAt.toISOString(),
    });
    expect(repository.renewDispatch(
      'web-1',
      created.id,
      { instance_id: 'instance-1', claim_token: 'stale-token', lease_seconds: 120 },
      renewedAt,
    )).toBeNull();

    expect(repository.completeDispatch('web-1', created.id, {
      instance_id: 'instance-2',
      claim_token: claimed!.claim_token!,
      status: 'completed',
      result: { answer: 'wrong owner' },
    })).toBeNull();

    const completed = repository.completeDispatch('web-1', created.id, {
      instance_id: 'instance-1',
      claim_token: claimed!.claim_token!,
      status: 'completed',
      session_id: 'session-1',
      result: { answer: 'done' },
      delivery_payload: {
        protocol: 'dsh-agora.presentation/v1',
        text: 'done',
        target: { provider: 'discord', conversation_ref: 'channel-1' },
      },
    }, new Date('2026-08-26T01:02:00.000Z'));
    expect(completed).toMatchObject({
      status: 'completed',
      session_id: 'session-1',
      result: { answer: 'done' },
    });

    const delivery = repository.claimDelivery(
      'web-1',
      'instance-1',
      60,
      new Date('2026-08-26T01:02:01.000Z'),
    );
    expect(delivery).toMatchObject({
      dispatch_id: created.id,
      node_id: 'web-1',
      status: 'claimed',
      attempt: 1,
      payload: { protocol: 'dsh-agora.presentation/v1', text: 'done' },
    });
    expect(delivery?.claim_token).toEqual(expect.any(String));

    const retried = repository.completeDelivery('web-1', delivery!.id, {
      instance_id: 'instance-1',
      claim_token: delivery!.claim_token!,
      status: 'retry',
      error: 'Discord unavailable',
      retry_delay_seconds: 30,
    }, new Date('2026-08-26T01:02:02.000Z'));
    expect(retried).toMatchObject({
      status: 'pending',
      error: 'Discord unavailable',
      next_attempt_at: '2026-08-26T01:02:32.000Z',
    });
    expect(repository.claimDelivery(
      'web-1', 'instance-1', 60, new Date('2026-08-26T01:02:31.000Z'),
    )).toBeNull();

    const reclaimed = repository.claimDelivery(
      'web-1', 'instance-1', 60, new Date('2026-08-26T01:02:32.000Z'),
    );
    expect(reclaimed?.attempt).toBe(2);
    const delivered = repository.completeDelivery('web-1', reclaimed!.id, {
      instance_id: 'instance-1',
      claim_token: reclaimed!.claim_token!,
      status: 'delivered',
      receipt: { provider_message_refs: ['message-1'] },
    }, new Date('2026-08-26T01:02:33.000Z'));
    expect(delivered).toMatchObject({
      status: 'delivered',
      receipt: { provider_message_refs: ['message-1'] },
      delivered_at: '2026-08-26T01:02:33.000Z',
    });
  });

  it('fences an expired owner and increments the attempt when work is reclaimed', () => {
    const db = createAgoraDatabase({ dbPath: makeDbPath() });
    databases.push(db);
    runMigrations(db);
    const repository = new RuntimeNodeRepository(db);
    repository.upsertNode('web-1', {
      protocol: 'dsh-agora.node/v1',
      instance_id: 'instance-1',
      plugin_version: '0.3.2',
      host_framework: 'deepseek-harness',
      runtime_provider: 'dsh',
      agents: [{ agent_ref: 'default', roles: [], capabilities: [] }],
      bots: [],
      capacity: { max_concurrent: 1, active: 0 },
      lease_seconds: 90,
    }, new Date('2026-08-26T01:00:00.000Z'));
    const created = repository.createDispatch('web-1', {
      runtime_target_ref: 'dsh:web-1:default',
      prompt: 'Long-running review.',
      idempotency_key: 'long-review',
    }, new Date('2026-08-26T01:00:00.000Z'));
    const first = repository.claimDispatch('web-1', 'instance-1', 120, new Date('2026-08-26T01:00:00.000Z'))!;

    expect(repository.completeDispatch('web-1', created.id, {
      instance_id: 'instance-1',
      claim_token: first.claim_token!,
      status: 'completed',
      result: { answer: 'too late' },
    }, new Date('2026-08-26T01:02:01.000Z'))).toBeNull();

    const second = repository.claimDispatch('web-1', 'instance-1', 120, new Date('2026-08-26T01:02:01.000Z'))!;
    expect(second.attempt).toBe(2);
    expect(second.claim_token).not.toBe(first.claim_token);
    expect(repository.completeDispatch('web-1', created.id, {
      instance_id: 'instance-1',
      claim_token: first.claim_token!,
      status: 'completed',
      result: { answer: 'stale owner' },
    }, new Date('2026-08-26T01:02:02.000Z'))).toBeNull();
  });
});
