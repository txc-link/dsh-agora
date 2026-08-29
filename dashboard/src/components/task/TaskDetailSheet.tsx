/* ═══════════════════════════════════════════
   TaskDetailSheet — R-F.1 thread detail panel
   ═══════════════════════════════════════════
   Shared conversation-thread body used by:
     - `pages/TasksPage.tsx` (existing) — the original full task workbench
     - `pages/ProjectDetailPage.tsx` (R-F.1) — click a task card → sheet opens

   Design constraint: this component never opens the sheet itself — it just
   renders the body — so any caller can wrap it with `WorkbenchDetailSheet`
   (R-F.1) or the existing TasksPage-level sheet without coupling.

   Data flow is intentionally routed through `useTaskStore`, the same store
   `TasksPage` already populates via `selectTask(id)` — so opening a task
   from the project page reuses the same Agora REST call chain
   (`getTask` + `getTaskStatus` + `getTaskConversation` + `getTaskConversationSummary`)
   already validated against `@agora-ts/contracts` schemas. No parallel
   HTTP client is introduced.
   ═══════════════════════════════════════════ */

import { useEffect, useMemo } from 'react';
import { useTasksPageCopy } from '@/lib/dashboardCopy';
import { formatRelativeTimestamp } from '@/lib/mockDashboard';
import { useTaskStore } from '@/stores/taskStore';
import { agoraClient } from '@/lib/agora-client';
import { AgoraApiError } from '@/types/agora';
import type {
  TaskConversationEntry,
  TaskStatus,
} from '@/types/task';

interface TaskDetailSheetProps {
  taskId: string | null;
}

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; error: AgoraApiError }
  | { kind: 'ready'; status: TaskStatus };

function statusForFetchError(err: unknown): AgoraApiError {
  if (err instanceof AgoraApiError) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err);
  return new AgoraApiError(0, 'network', message, { cause: err });
}

export function TaskDetailSheet({ taskId }: TaskDetailSheetProps) {
  const copy = useTasksPageCopy();

  const selectedTaskId = useTaskStore((state) => state.selectedTaskId);
  const selectedTaskStatus = useTaskStore((state) => state.selectedTaskStatus);
  const detailLoading = useTaskStore((state) => state.detailLoading);
  const selectTask = useTaskStore((state) => state.selectTask);

  // Drive the store from R-F.1's "open this task from the project page"
  // use case. The store already keeps a single selectedTaskId; if a caller
  // passes a taskId that does not match the store's current selection we
  // kick off a `selectTask(taskId)` (which is what TasksPage does).
  useEffect(() => {
    if (!taskId || taskId === selectedTaskId) {
      return;
    }
    void selectTask(taskId).catch(() => undefined);
  }, [taskId, selectedTaskId, selectTask]);

  const fetchState = useMemo<LoadState>(() => {
    if (!taskId) return { kind: 'idle' };
    if (detailLoading && selectedTaskId !== taskId) {
      return { kind: 'loading' };
    }
    if (selectedTaskId === taskId && selectedTaskStatus) {
      return { kind: 'ready', status: selectedTaskStatus };
    }
    // We have a taskId but the store has not produced a status yet — surface
    // the store's error message via AgoraApiError when present.
    const storeError = useTaskStore.getState().error;
    if (storeError) {
      return { kind: 'error', error: statusForFetchError(storeError) };
    }
    return { kind: 'loading' };
  }, [taskId, detailLoading, selectedTaskId, selectedTaskStatus]);

  if (fetchState.kind === 'idle') {
    return (
      <p className="type-body-sm" role="status">
        {copy.detailLoadingSummary}
      </p>
    );
  }
  if (fetchState.kind === 'loading') {
    return (
      <p className="type-body-sm" role="status">
        {copy.detailLoadingSummary}
      </p>
    );
  }
  if (fetchState.kind === 'error') {
    const { error } = fetchState;
    return (
      <div className="space-y-3">
        <p className="type-heading-sm">{copy.detailErrorTitle}</p>
        <p className="type-text-xs break-all">{`${error.status} ${error.statusText}`}</p>
        <p className="type-text-xs break-all">{error.body}</p>
      </div>
    );
  }

  const status = fetchState.status;
  const entries = status.conversation ?? [];
  const summary = status.conversationSummary;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h4 className="section-title">{status.task.title}</h4>
        <p className="type-text-xs">
          {status.task.id} · {summary?.total_entries ?? entries.length} entries
        </p>
        {summary?.has_unread ? (
          <span className="status-pill status-pill--warn">{summary.unread_count} unread</span>
        ) : null}
      </header>

      <section className="sheet-section">
        <h4 className="section-title">{copy.conversationTitle}</h4>
        <div className="mt-4 space-y-3">
          {entries.length === 0 ? (
            <p className="type-body-sm">{copy.conversationEmpty}</p>
          ) : (
            entries.map((entry) => (
              <ConversationRow key={entry.id} entry={entry} />
            ))
          )}
        </div>
      </section>

      <footer className="type-text-xs break-all opacity-60">
        agora-client baseUrl: {agoraClient.baseUrl}
      </footer>
    </div>
  );
}

interface ConversationRowProps {
  entry: TaskConversationEntry;
}

function ConversationRow({ entry }: ConversationRowProps) {
  return (
    <div className="data-row">
      <div className="min-w-0 flex-1">
        <p className="type-label-sm">
          {entry.display_name ?? entry.author_ref ?? entry.author_kind}
          {' / '}
          {entry.provider}
        </p>
        {entry.statusEvent ? (
          <div className="timeline-status-card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="status-pill status-pill--neutral">{entry.statusEvent.eventType}</span>
              <span className="type-text-xs">{entry.statusEvent.taskState}</span>
              {entry.statusEvent.currentStage ? (
                <span className="type-text-xs">stage: {entry.statusEvent.currentStage}</span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {entry.statusEvent.executionKind ? (
                <span className="type-text-xs">execution: {entry.statusEvent.executionKind}</span>
              ) : null}
              {entry.statusEvent.controllerRef ? (
                <span className="type-text-xs">controller: {entry.statusEvent.controllerRef}</span>
              ) : null}
              {entry.statusEvent.allowedActions.length > 0 ? (
                <span className="type-text-xs">
                  actions: {entry.statusEvent.allowedActions.join(', ')}
                </span>
              ) : null}
            </div>
            {entry.statusEvent.workspacePath ? (
              <p className="type-text-xs mt-2 break-all">workspace: {entry.statusEvent.workspacePath}</p>
            ) : null}
          </div>
        ) : null}
        <p className="type-body-sm mt-2 whitespace-pre-wrap">{entry.body}</p>
      </div>
      <span className="type-text-xs">{formatRelativeTimestamp(entry.occurred_at)}</span>
    </div>
  );
}
