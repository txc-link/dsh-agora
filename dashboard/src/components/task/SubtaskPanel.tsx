import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleDashed, Loader2, ShieldAlert, XCircle } from 'lucide-react';
import { ApiTaskProgressDto, getTaskProgress } from '@/lib/api';
import { StateBadge } from '@/components/ui/StateBadge';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface SubtaskPanelProps {
  taskId: string;
}

/**
 * Subtask progress panel. Calls GET /api/tasks/:taskId/progress and renders
 * a compact progress bar + per-state counts. Designed to be embedded in any
 * task detail surface (TaskDetailSheet, workbench, etc.).
 */
export function SubtaskPanel({ taskId }: SubtaskPanelProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState<ApiTaskProgressDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const row = await getTaskProgress(taskId);
      setProgress(row);
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'unknown error');
      setStatus('error');
    }
  }, [taskId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (status === 'loading' && !progress) {
    return <p className="text-sm text-muted-foreground">loading subtask progress…</p>;
  }
  if (status === 'error' && error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!progress) return null;

  const { subtasks_total: total, percent } = progress;
  return (
    <section className="flex flex-col gap-3 rounded-md border bg-card p-4">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {t('subtasks.title', 'Subtasks')}
        </h2>
        <span className="text-xs text-muted-foreground">
          {progress.subtasks_done}/{total} done · parent {progress.parent_state}
        </span>
      </header>

      <div className="flex flex-col gap-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${ percent }%` }}
            data-testid="subtask-progress-bar"
          />
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3" /> in-flight {progress.subtasks_in_flight}
          </span>
          <span className="flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" /> failed {progress.subtasks_failed}
          </span>
          <span className="flex items-center gap-1">
            <XCircle className="h-3 w-3" /> cancelled {progress.subtasks_cancelled}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> done {progress.subtasks_done}
          </span>
          <span className="flex items-center gap-1">
            <CircleDashed className="h-3 w-3" /> total {total}
          </span>
        </div>
      </div>

      {total === 0 && (
        <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
          no subtasks yet — create some via{' '}
          <code className="font-mono">agora task breakdown &lt;taskId&gt;</code> or the
          REST API.
        </p>
      )}

      {progress && (
        <StateBadge tone={progress.parent_state === 'active' ? 'low' : 'medium'}>
          parent {progress.parent_state}
        </StateBadge>
      )}
    </section>
  );
}