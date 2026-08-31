import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, Save } from 'lucide-react';
import {
  ApiMarkdownDocumentDto,
  getMarkdownArtifact,
  submitMarkdownArtifact,
} from '@/lib/api';

type Status = 'idle' | 'loading' | 'ready' | 'saving' | 'error';

interface MarkdownDocumentPanelProps {
  artifactId: string;
}

/**
 * Markdown document panel — read + submit (v0.1 single-writer). Loads
 * the latest markdown via GET /api/artifacts/:id/markdown, renders it
 * inside a <pre>, and offers a textarea to submit a new version that
 * creates a new content-addressed artifact. The history is reconstructed
 * by listing artifacts with the same owner_ref — not surfaced here.
 */
export function MarkdownDocumentPanel({ artifactId }: MarkdownDocumentPanelProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>('idle');
  const [document, setDocument] = useState<ApiMarkdownDocumentDto | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const doc = await getMarkdownArtifact(artifactId);
      setDocument(doc);
      setDraft(doc.content);
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'unknown error');
      setStatus('error');
    }
  }, [artifactId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSubmit = useCallback(async () => {
    if (!document) return;
    setStatus('saving');
    setError(null);
    try {
      const response = await submitMarkdownArtifact(artifactId, {
        content: draft,
        parent_artifact_id: document.artifact_id,
      });
      setDocument({
        artifact_id: response.artifact.id,
        content: draft,
        content_hash: response.content_hash,
        size_bytes: response.artifact.size_bytes,
        created_at: response.artifact.created_at,
        parent_artifact_id: document.artifact_id,
      });
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'unknown error');
      setStatus('error');
    }
  }, [artifactId, document, draft]);

  if (status === 'loading' && !document) {
    return <p className="text-sm text-muted-foreground">loading markdown…</p>;
  }
  if (status === 'error' && error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }
  if (!document) return null;

  return (
    <section className="flex flex-col gap-3 rounded-md border bg-card p-4">
      <header className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <FileText className="h-4 w-4" /> {t('docs.title', 'Markdown document')}
        </h2>
        <span className="text-xs text-muted-foreground">
          sha {document.content_hash.slice(0, 12)} · {document.size_bytes} bytes
        </span>
      </header>
      <textarea
        className="min-h-[160px] w-full rounded-md border bg-background p-2 font-mono text-xs"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck={false}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1 rounded-md border px-3 py-1 text-sm disabled:opacity-50"
          disabled={status === 'saving' || draft === document.content}
          onClick={() => void handleSubmit()}
        >
          <Save className="h-4 w-4" /> {t('docs.submit', 'submit new version')}
        </button>
        {document.parent_artifact_id && (
          <span className="text-xs text-muted-foreground">
            parent: {document.parent_artifact_id.slice(0, 12)}
          </span>
        )}
      </div>
    </section>
  );
}