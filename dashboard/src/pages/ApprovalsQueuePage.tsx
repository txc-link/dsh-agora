import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  ApiPendingApprovalRequestDto,
  decideApproval,
  listPendingApprovals,
} from '@/lib/api';
import { useSessionStore } from '@/stores/sessionStore';
import { StateBadge } from '@/components/ui/StateBadge';
import { StaggeredItem } from '@/components/ui/StaggeredItem';

type Status = 'idle' | 'loading' | 'ready' | 'error';

export function ApprovalsQueuePage() {
  const { t } = useTranslation();
  const session = useSessionStore((store) => store.session);
  const [status, setStatus] = useState<Status>('idle');
  const [approvals, setApprovals] = useState<ApiPendingApprovalRequestDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const { approvals: rows } = await listPendingApprovals({ limit: 100 });
      setApprovals(rows);
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'unknown error');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDecide = useCallback(
    async (approvalId: string, decision: 'approve' | 'reject') => {
      setPendingId(approvalId);
      try {
        await decideApproval(approvalId, { decision, comment: `dashboard ${decision}` });
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'unknown error');
        setStatus('error');
      } finally {
        setPendingId(null);
      }
    },
    [refresh],
  );

  const reviewerLabel = useMemo(() => session?.username ?? 'dashboard-anonymous', [session]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ShieldCheck className="h-5 w-5" /> {t('approvals.title', 'Approval Queue')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              'approvals.subtitle',
              'Pending approvals across all tasks. Decisions here apply the gate flow and resolve the row. (A4: dashboard session only.)',
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">reviewer: {reviewerLabel}</span>
          <button
            type="button"
            className="rounded-md border px-3 py-1 text-sm"
            onClick={() => void refresh()}
          >
            refresh
          </button>
        </div>
      </header>

      {status === 'loading' && <p className="text-sm text-muted-foreground">loading…</p>}
      {status === 'error' && error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {status === 'ready' && approvals.length === 0 && (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          no pending approvals
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {approvals.map((row) => (
          <StaggeredItem key={row.id}>
            <li className="flex items-start justify-between gap-4 rounded-md border bg-card p-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <StateBadge tone="medium">{row.gate_type}</StateBadge>
                  <span className="font-mono text-xs text-muted-foreground">{row.id}</span>
                </div>
                <p className="text-sm">
                  task <span className="font-mono">{row.task_id}</span> · stage{' '}
                  <span className="font-mono">{row.stage_id}</span>
                </p>
                {row.request_comment && (
                  <p className="text-sm text-muted-foreground">{row.request_comment}</p>
                )}
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="h-3 w-3" />
                  requested by {row.requested_by} @ {row.requested_at}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                  disabled={pendingId === row.id}
                  onClick={() => void handleDecide(row.id, 'approve')}
                >
                  <CheckCircle2 className="h-4 w-4" /> approve
                </button>
                <button
                  type="button"
                  className="flex items-center gap-1 rounded-md border border-destructive/40 px-3 py-1 text-sm text-destructive disabled:opacity-50"
                  disabled={pendingId === row.id}
                  onClick={() => void handleDecide(row.id, 'reject')}
                >
                  <XCircle className="h-4 w-4" /> reject
                </button>
              </div>
            </li>
          </StaggeredItem>
        ))}
      </ul>
    </div>
  );
}