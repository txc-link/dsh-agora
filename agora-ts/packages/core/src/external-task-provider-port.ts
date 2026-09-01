export interface CreateExternalTaskInput {
  readonly projectRef: string;
  readonly title: string;
  readonly content?: string | null;
  readonly start?: string | null;
  readonly due?: string | null;
  readonly timeZone?: string | null;
}

export interface ExternalPlanningTask {
  readonly id: string;
  readonly projectRef: string;
  readonly title: string;
  readonly content: string | null;
  readonly start: string | null;
  readonly due: string | null;
  readonly timeZone: string | null;
  readonly status: 'open' | 'completed';
}

export interface ExternalTaskProviderPort {
  readonly providerId: string;
  createTask(input: CreateExternalTaskInput): Promise<ExternalPlanningTask>;
  getTask?(input: { projectRef: string; taskRef: string }): Promise<ExternalPlanningTask | null>;
  completeTask?(input: { projectRef: string; taskRef: string }): Promise<void>;
  deleteTask?(input: { projectRef: string; taskRef: string }): Promise<void>;
}
