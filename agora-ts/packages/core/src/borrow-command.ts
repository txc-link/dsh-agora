/**
 * borrow-command.ts — Phase 3.5-2: Agent borrow CLI 入口 (§2 Entry Surface).
 *
 * Subcommands: create | list | show. Plain JSON output. No interactive prompts
 * (the CLI is for agents, not humans; humans use Dashboard).
 */

import type { IBorrowRequestRepository } from '@agora-ts/contracts';
import { BorrowService } from './borrow-service.js';
import type { Permission, Posture } from './worksite/types.js';

export interface BorrowCommandDeps {
  borrowService: BorrowService;
  borrowRepo: IBorrowRequestRepository;
}

export type BorrowSubcommand = 'create' | 'list' | 'show';

export interface RunBorrowCommandOptions {
  subcommand: BorrowSubcommand;
  // create
  actor?: string;
  target?: string;
  scope?: string;
  permissions?: string;
  posture?: Posture;
  ttlMs?: number;
  reason?: string;
  // list
  listActor?: string;
  listPending?: boolean;
  // show
  requestId?: string;
}

export interface BorrowCommandResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

const VALID_POSTURES = new Set(['Strict', 'Auto', 'Dangerous'] as const);
const VALID_PERMISSIONS = new Set(['read', 'write', 'delete', 'execute'] as const);

export async function runBorrowCommand(
  deps: BorrowCommandDeps,
  options: RunBorrowCommandOptions,
): Promise<BorrowCommandResult> {
  switch (options.subcommand) {
    case 'create':
      return runCreate(deps, options);
    case 'list':
      return runList(deps, options);
    case 'show':
      return runShow(deps, options);
    default:
      return { ok: false, error: `unknown subcommand: ${options.subcommand}` };
  }
}

function requireString(value: string | undefined, field: string): string | null {
  if (value === undefined || value === '') {
    return `${field} is required`;
  }
  return null;
}

function parsePosture(value: string | undefined): { value: Posture | null; error: string | null } {
  if (value === undefined) {
    return { value: 'Auto', error: null };
  }
  if (!VALID_POSTURES.has(value as Posture)) {
    return { value: null, error: `invalid posture: ${value} (must be Strict|Auto|Dangerous)` };
  }
  return { value: value as Posture, error: null };
}

function parsePermissions(raw: string | undefined): { value: Permission[] | null; error: string | null } {
  if (raw === undefined || raw === '') {
    return { value: [], error: null };
  }
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const invalid = items.find((p) => !VALID_PERMISSIONS.has(p as Permission));
  if (invalid !== undefined) {
    return { value: null, error: `invalid permission: ${invalid} (must be read|write|delete|execute)` };
  }
  return { value: items as Permission[], error: null };
}

function parseTtlMs(raw: number | undefined): { value: number | null; error: string | null } {
  if (raw === undefined) {
    return { value: 3600_000, error: null };
  }
  if (!Number.isFinite(raw) || raw < 0) {
    return { value: null, error: `ttlMs must be a non-negative number` };
  }
  return { value: Math.floor(raw), error: null };
}

async function runCreate(
  deps: BorrowCommandDeps,
  opts: RunBorrowCommandOptions,
): Promise<BorrowCommandResult> {
  for (const field of ['actor', 'target', 'scope', 'reason'] as const) {
    const err = requireString(opts[field], field);
    if (err !== null) return { ok: false, error: err };
  }

  const posture = parsePosture(opts.posture);
  if (posture.error !== null) return { ok: false, error: posture.error };
  const permissions = parsePermissions(opts.permissions);
  if (permissions.error !== null) return { ok: false, error: permissions.error };
  const ttlMs = parseTtlMs(opts.ttlMs);
  if (ttlMs.error !== null) return { ok: false, error: ttlMs.error };

  const result = deps.borrowService.createBorrow({
    actor: opts.actor!,
    target: opts.target!,
    scope: opts.scope!,
    permissions: permissions.value!,
    posture: posture.value!,
    ttlMs: ttlMs.value!,
    reason: opts.reason!,
  });

  return { ok: true, data: { request: result.request, decision: result.decision } };
}

async function runList(
  deps: BorrowCommandDeps,
  opts: RunBorrowCommandOptions,
): Promise<BorrowCommandResult> {
  const rows = opts.listPending === true
    ? deps.borrowRepo.listPending()
    : opts.listActor !== undefined
      ? deps.borrowRepo.listByActor(opts.listActor)
      : deps.borrowRepo.listPending();
  return { ok: true, data: rows };
}

async function runShow(
  deps: BorrowCommandDeps,
  opts: RunBorrowCommandOptions,
): Promise<BorrowCommandResult> {
  const err = requireString(opts.requestId, 'requestId');
  if (err !== null) return { ok: false, error: err };
  const row = deps.borrowRepo.getById(opts.requestId!);
  if (row === null) return { ok: false, error: `borrow request not found: ${opts.requestId}` };
  return { ok: true, data: row };
}
