export interface TaskMemorySummaryInput {
  task: {
    id: string;
    title: string;
    description: string | null;
    state: string;
    type: string;
  };
  conversation: Array<{ body: string; occurred_at: string; author_ref: string | null }>;
  progress: Array<{ content: string; created_at?: string }>;
}

export interface StructuredTaskMemorySummary {
  facts: string[];
  decisions: string[];
  lessons: string[];
  unresolved: string[];
  confidence: number | null;
}

export interface TaskMemorySummaryProvider {
  summarize(input: TaskMemorySummaryInput): Promise<StructuredTaskMemorySummary> | StructuredTaskMemorySummary;
}

export interface MemoryRedactionResult {
  text: string;
  redacted: boolean;
  patterns: string[];
}

export interface MemoryRedactor {
  redact(text: string): MemoryRedactionResult;
}

/** Stable local fallback. A model-backed provider can be injected later. */
export class DeterministicTaskMemorySummaryProvider implements TaskMemorySummaryProvider {
  summarize(input: TaskMemorySummaryInput): StructuredTaskMemorySummary {
    const clean = (value: string) => value.replace(/\s+/gu, ' ').trim();
    const facts = [
      `任务“${clean(input.task.title)}”状态为 ${input.task.state}`,
      input.task.description ? `目标：${clean(input.task.description)}` : '',
      ...input.progress.slice(-6).map((entry) => clean(entry.content)).filter(Boolean),
    ].filter(Boolean);
    const decisions = input.conversation.slice(-12)
      .map((entry) => clean(entry.body))
      .filter((body) => /\b(decid|recommend|approved|选择|决定|采用|同意|结论)\w*/iu.test(body))
      .slice(-6);
    const unresolved = input.conversation.slice(-12)
      .map((entry) => clean(entry.body))
      .filter((body) => /\b(block|pending|todo|follow[- ]?up|未决|待办|阻塞|需要确认|风险)\w*/iu.test(body))
      .slice(-6);
    const lessons = input.progress.slice(-6)
      .map((entry) => clean(entry.content))
      .filter((body) => /\b(learn|lesson|注意|教训|经验|验证|失败)\w*/iu.test(body))
      .slice(-6);
    return { facts, decisions, lessons, unresolved, confidence: facts.length > 0 ? 0.65 : null };
  }
}

export class DefaultMemoryRedactor implements MemoryRedactor {
  redact(text: string): MemoryRedactionResult {
    const patterns: string[] = [];
    let output = text;
    const replacements: Array<[string, RegExp]> = [
      ['bearer_token', /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/giu],
      ['secret_assignment', /\b(?:password|passwd|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*[^\s,;]+/giu],
      ['jwt', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/gu],
    ];
    for (const [name, pattern] of replacements) {
      if (pattern.test(output)) { patterns.push(name); output = output.replace(pattern, `[REDACTED:${name}]`); }
    }
    return { text: output, redacted: patterns.length > 0, patterns };
  }
}
