import {
  ActionAttemptRepository,
  ActionReceiptRepository,
  CollaborationPlanRepository,
  CoordinationRepository,
  DelegationAuthorityRepository,
  ExecutionBaselineRepository,
  FederationRepository,
  ProjectBrainIndexJobRepository,
  RuntimeTargetOverlayRepository,
  PlanningBindingRepository,
  TaskRepository,
  TaskMemorySummaryRepository,
  RoutineRepository,
  TaskConversationRepository,
  ProgressLogRepository,
  createAgoraDatabase,
  runMigrations,
} from '@agora-ts/db';
import type { ServerCompositionFactories, ServerCompositionOptions } from './composition.js';
import { buildServerComposition, ensureRuntimeBrainPackRoot } from './composition.js';
import {
  ensureBundledAgoraAssetsInstalled,
  loadAgoraConfig,
  resolveAgoraRuntimeEnvironmentFromConfigPackage,
  type AgoraConfig,
} from '@agora-ts/config';
import {
  ActionAuditService,
  ProjectBrainChunkingPolicy,
  ProjectBrainDoctorService,
  ProjectBrainIndexQueueService,
  ProjectBrainIndexService,
  ProjectBrainIndexWorkerService,
  ArtifactService,
  CoordinationService,
  MemoryService,
  MergeCoordinatorService,
  RuntimeNodeCredentialService,
  RuntimeTargetService,
  CalendarService,
  PlanningService,
  PlanningSyncService,
  GovernedDispatchService,
  TaskMemorySummaryService,
  RoutineService,
} from '@agora-ts/core';
import { OpenAiCompatibleProjectBrainEmbeddingAdapter, QdrantProjectBrainVectorIndexAdapter } from '@agora-ts/adapters-brain';
import { A2aGatewayService } from '@agora-ts/adapters-runtime';
import { createCalendarProviderFromEnv, readCalendarEnv } from './calendar-factory.js';
import { createExternalTaskProviderFromEnv, readTickTickEnv } from './planning-factory.js';
import { Mem0RestAdapter } from '@agora-ts/adapters-mem0';
import { FilesystemArtifactContentStore } from '@agora-ts/adapters-materialization';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface CreateServerRuntimeOptions extends ServerCompositionOptions {
  configPath?: string;
  factories?: Partial<ServerCompositionFactories>;
}

export interface ObservationSchedulerTickResult {
  observed_at: string;
  craftsman: {
    scanned: number;
    probed: number;
    progressed: number;
  };
  tasks: {
    scanned_tasks: number;
    controller_pings: number;
    roster_pings: number;
    human_pings: number;
    inbox_items: number;
  };
}

export interface ObservationSchedulerMetricsSnapshot {
  observationTicksByResult: {
    success: number;
    error: number;
  };
  projectBrainIndexWorkerTicksByResult: {
    success: number;
    error: number;
  };
}

export interface ObservationSchedulerController {
  enabled: boolean;
  interval_ms: number | null;
  tick: () => ObservationSchedulerTickResult;
  getMetricsSnapshot: () => ObservationSchedulerMetricsSnapshot;
  stop: () => void;
}

function incrementCounter(counter: Map<string, number>, key: string) {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function emitStructuredLog(enabled: boolean, payload: Record<string, unknown>) {
  if (!enabled) {
    return;
  }
  console.info(JSON.stringify(payload));
}

function resolveDashboardDir() {
  const explicit = process.env.AGORA_DASHBOARD_DIR;
  if (explicit && existsSync(explicit)) {
    return explicit;
  }
  const distDir = new URL('../../../../dashboard/dist', import.meta.url).pathname;
  if (existsSync(distDir)) {
    return distDir;
  }
  return undefined;
}

function createObservationScheduler(runtime: {
  config: AgoraConfig;
  taskService: {
    observeCraftsmanExecutions: (input: { runningAfterMs: number; waitingAfterMs: number }) => {
      scanned: number;
      probed: number;
      progressed: number;
    };
    probeInactiveTasks: (input: { controllerAfterMs: number; rosterAfterMs: number; inboxAfterMs: number }) => {
      scanned_tasks: number;
      controller_pings: number;
      roster_pings: number;
      human_pings: number;
      inbox_items: number;
    };
  };
  projectBrainIndexWorkerService?: Pick<ProjectBrainIndexWorkerService, 'drainPendingJobs'>;
  notificationDispatcher?: { scan: () => Promise<{ delivered: number; failed: number }> };
  memorySummaryService?: Pick<TaskMemorySummaryService, 'scanTerminalTasks'>;
}): ObservationSchedulerController {
  const { scheduler } = runtime.config;
  const intervalMs = scheduler.enabled ? scheduler.scan_interval_sec * 1000 : null;
  const structuredLogs = runtime.config.observability.structured_logs;
  const observationTicksByResult = new Map<string, number>();
  const projectBrainIndexWorkerTicksByResult = new Map<string, number>();
  const executeTick = (): ObservationSchedulerTickResult => ({
    observed_at: new Date().toISOString(),
    craftsman: runtime.taskService.observeCraftsmanExecutions({
      runningAfterMs: scheduler.craftsman_running_after_sec * 1000,
      waitingAfterMs: scheduler.craftsman_waiting_after_sec * 1000,
    }),
    tasks: runtime.taskService.probeInactiveTasks({
      controllerAfterMs: scheduler.task_probe_controller_after_sec * 1000,
      rosterAfterMs: scheduler.task_probe_roster_after_sec * 1000,
      inboxAfterMs: scheduler.task_probe_inbox_after_sec * 1000,
    }),
  });
  const tick = (): ObservationSchedulerTickResult => {
    try {
      const result = executeTick();
      incrementCounter(observationTicksByResult, 'success');
      emitStructuredLog(structuredLogs, {
        module: 'scheduler',
        msg: 'observation_tick',
        result: 'success',
        observed_at: result.observed_at,
        craftsman: result.craftsman,
        tasks: result.tasks,
      });
      return result;
    } catch (error) {
      incrementCounter(observationTicksByResult, 'error');
      emitStructuredLog(structuredLogs, {
        module: 'scheduler',
        msg: 'observation_tick',
        result: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  let timer: NodeJS.Timeout | null = null;
  if (intervalMs !== null) {
    timer = setInterval(() => {
      try {
        tick();
      } catch (error) {
        console.error('[agora] observation scheduler tick failed', error);
      }
      void runtime.notificationDispatcher?.scan().catch((error: unknown) => {
        emitStructuredLog(structuredLogs, {
          module: 'scheduler',
          msg: 'notification_scan_tick',
          result: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      });
      void runtime.memorySummaryService?.scanTerminalTasks().catch((error: unknown) => {
        emitStructuredLog(structuredLogs, {
          module: 'scheduler', msg: 'memory_summary_tick', result: 'error',
          error: error instanceof Error ? error.message : String(error),
        });
      });
        if (runtime.projectBrainIndexWorkerService) {
          void runtime.projectBrainIndexWorkerService
            .drainPendingJobs({ limit: 25 })
            .then((result: { processed: number; succeeded: number; failed: number; pending: number }) => {
              incrementCounter(projectBrainIndexWorkerTicksByResult, 'success');
              emitStructuredLog(structuredLogs, {
                module: 'scheduler',
                msg: 'project_brain_index_tick',
                result: 'success',
                processed: result.processed,
                succeeded: result.succeeded,
                failed: result.failed,
                pending: result.pending,
              });
            })
            .catch((error: unknown) => {
              incrementCounter(projectBrainIndexWorkerTicksByResult, 'error');
              emitStructuredLog(structuredLogs, {
                module: 'scheduler',
                msg: 'project_brain_index_tick',
                result: 'error',
                error: error instanceof Error ? error.message : String(error),
              });
              console.error('[agora] project brain index worker tick failed', error);
            });
        }
    }, intervalMs);
    timer.unref?.();
  }

  return {
    enabled: scheduler.enabled,
    interval_ms: intervalMs,
    tick,
    getMetricsSnapshot: () => ({
      observationTicksByResult: {
        success: observationTicksByResult.get('success') ?? 0,
        error: observationTicksByResult.get('error') ?? 0,
      },
      projectBrainIndexWorkerTicksByResult: {
        success: projectBrainIndexWorkerTicksByResult.get('success') ?? 0,
        error: projectBrainIndexWorkerTicksByResult.get('error') ?? 0,
      },
    }),
    stop: () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}

function parseOptionalInt(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return Number.parseInt(trimmed, 10);
}

function buildVectorIndexOptions() {
  const vectorSize = parseOptionalInt(process.env.OPENAI_EMBEDDING_DIMENSION);
  return {
    ...(vectorSize !== null ? { vectorSize } : {}),
  };
}

function createDefaultProjectBrainIndexWorkerService(runtime: {
  db: ReturnType<typeof createAgoraDatabase>;
  projectBrainService: ReturnType<typeof buildServerComposition>['projectBrainService'];
}) {
  if (!process.env.OPENAI_API_KEY || !process.env.QDRANT_URL) {
    return undefined;
  }
  const indexService = new ProjectBrainIndexService({
    projectBrainService: runtime.projectBrainService,
    chunkingPolicy: new ProjectBrainChunkingPolicy(),
    embeddingPort: new OpenAiCompatibleProjectBrainEmbeddingAdapter(),
    vectorIndexPort: new QdrantProjectBrainVectorIndexAdapter(buildVectorIndexOptions()),
  });
  return new ProjectBrainIndexWorkerService({
    queueService: new ProjectBrainIndexQueueService({ repository: new ProjectBrainIndexJobRepository(runtime.db) }),
    indexService,
  });
}

function createDefaultProjectBrainDoctorService(runtime: {
  config: AgoraConfig;
  db: ReturnType<typeof createAgoraDatabase>;
  projectBrainService: ReturnType<typeof buildServerComposition>['projectBrainService'];
}) {
  const embeddingPort = process.env.OPENAI_API_KEY
    ? new OpenAiCompatibleProjectBrainEmbeddingAdapter()
    : undefined;
  return new ProjectBrainDoctorService({
    dbPath: runtime.config.db_path,
    projectBrainService: runtime.projectBrainService,
    queueService: new ProjectBrainIndexQueueService({ repository: new ProjectBrainIndexJobRepository(runtime.db) }),
    ...(embeddingPort ? { embeddingPort } : {}),
  });
}

export function createServerRuntime(options: CreateServerRuntimeOptions = {}) {
  const config = loadAgoraConfig(options.configPath ?? process.env.AGORA_CONFIG_PATH ?? '');
  const runtimeEnv = resolveAgoraRuntimeEnvironmentFromConfigPackage();
  ensureBundledAgoraAssetsInstalled({
    projectRoot: runtimeEnv.projectRoot ?? new URL('../../../../', import.meta.url).pathname,
  });
  const db = createAgoraDatabase({ dbPath: config.db_path, busyTimeoutMs: config.db_busy_timeout_ms });
  runMigrations(db);
  const actionAuditService = new ActionAuditService({
    attempts: new ActionAttemptRepository(db),
    receipts: new ActionReceiptRepository(db),
    plans: new CollaborationPlanRepository(db),
    authorities: new DelegationAuthorityRepository(db),
    baselines: new ExecutionBaselineRepository(db),
  });
  const governedDispatchService = new GovernedDispatchService({
    plans: new CollaborationPlanRepository(db),
    authorities: new DelegationAuthorityRepository(db),
    baselines: new ExecutionBaselineRepository(db),
  });
  const calendarEnv = readCalendarEnv(process.env);
  const calendarProvider = calendarEnv ? createCalendarProviderFromEnv(calendarEnv) : undefined;
  const calendarService = calendarProvider ? new CalendarService({
    provider: calendarProvider,
    ...(calendarEnv?.timezoneOffsetMinutes === undefined ? {} : { timezoneOffsetMinutes: calendarEnv.timezoneOffsetMinutes }),
  }) : undefined;
  const tickTickEnv = readTickTickEnv(process.env);
  const externalTaskProvider = tickTickEnv ? createExternalTaskProviderFromEnv(tickTickEnv) : undefined;
  const planningRepo = new PlanningBindingRepository(db);
  const planningService = new PlanningService({
    repo: planningRepo,
    taskRepo: new TaskRepository(db),
    ...(calendarProvider ? { calendarProvider } : {}),
    ...(externalTaskProvider ? { taskProvider: externalTaskProvider } : {}),
  });
  const templatesDir = new URL('../../../templates', import.meta.url).pathname;
  const rolePackDir = new URL('../../../role-packs/agora-default', import.meta.url).pathname;
  const brainPackDir = ensureRuntimeBrainPackRoot(runtimeEnv.projectRoot);
  const composition = buildServerComposition({
    config,
    runtimeEnv,
    db,
    templatesDir,
    rolePackDir,
    brainPackDir,
    actionAuditService,
    ...(options.isCraftsmanSessionAlive ? { isCraftsmanSessionAlive: options.isCraftsmanSessionAlive } : {}),
  }, options.factories);
  const { taskService } = composition;
  const planningSyncService = new PlanningSyncService({
    repo: planningRepo,
    taskPort: {
      getTask: taskId => taskService.getTask(taskId),
      transitionTask: (taskId, state, reason) => taskService.updateTaskState(taskId, state, { reason }),
    },
    ...(calendarProvider ? { calendarProvider } : {}),
    ...(externalTaskProvider ? { taskProvider: externalTaskProvider } : {}),
  });
  const runtimeTargetService = new RuntimeTargetService({
    agentInventory: composition.agentRegistry,
    overlayRepository: new RuntimeTargetOverlayRepository(db),
  });
  const federationRepository = new FederationRepository(db);
  const artifactService = new ArtifactService(
    federationRepository,
    new FilesystemArtifactContentStore(process.env.AGORA_ARTIFACTS_DIR ?? join(dirname(config.db_path), 'artifacts')),
  );
  const memoryService = new MemoryService(federationRepository);
  const groupMemoryPort = process.env.AGORA_MEM0_URL || process.env.AGORA_MEM0_TOKEN
    ? new Mem0RestAdapter({
        baseUrl: process.env.AGORA_MEM0_URL ?? 'http://127.0.0.1:8888',
        token: process.env.AGORA_MEM0_TOKEN ?? null,
      })
    : undefined;
  const taskMemorySummaryService = groupMemoryPort
    ? new TaskMemorySummaryService({
        taskRepository: new TaskRepository(db),
        conversationRepository: new TaskConversationRepository(db),
        progressRepository: new ProgressLogRepository(db),
        summaryRepository: new TaskMemorySummaryRepository(db),
        memoryPort: groupMemoryPort,
      })
    : undefined;
  const routineService = new RoutineService({ repository: new RoutineRepository(db) });
  const runtimeNodeCredentialService = new RuntimeNodeCredentialService(federationRepository);
  const coordinationService = new CoordinationService({
    repository: new CoordinationRepository(db),
    runtimeNodes: composition.runtimeNodeRegistryService,
    governedDispatchService,
    memory: {
      query: input => memoryService.query({ ...input, limit: input.limit ?? 20 }),
    },
  });
  const mergeCoordinatorService = new MergeCoordinatorService(
    federationRepository,
    artifactService,
    projectId => composition.projectService.getProjectRepoPath(projectId),
  );
  const publicBaseUrl = process.env.AGORA_PUBLIC_BASE_URL ?? runtimeEnv.apiBaseUrl;
  const a2aGatewayService = new A2aGatewayService({
    runtimeNodes: composition.runtimeNodeRegistryService,
    publicBaseUrl,
  });
  composition.discordPresenceService?.start();
  composition.discordThreadIngressService?.start();
  composition.ccConnectBridgeRuntimeService?.start();
  if (config.scheduler.startup_recovery_on_boot) {
    taskService.startupRecoveryScan();
  }
  const projectBrainIndexWorkerService = options.factories?.createProjectBrainIndexWorkerService?.({
    config,
    runtimeEnv,
    db,
    templatesDir,
    rolePackDir,
    brainPackDir,
    ...(options.isCraftsmanSessionAlive ? { isCraftsmanSessionAlive: options.isCraftsmanSessionAlive } : {}),
  }, {
    projectBrainService: composition.projectBrainService,
  }) ?? createDefaultProjectBrainIndexWorkerService({
    db,
    projectBrainService: composition.projectBrainService,
  });
  const projectBrainDoctorService = createDefaultProjectBrainDoctorService({
    config,
    db,
    projectBrainService: composition.projectBrainService,
  });
  const observationScheduler = createObservationScheduler({
    config,
    taskService,
    ...(composition.notificationDispatcher ? { notificationDispatcher: composition.notificationDispatcher } : {}),
    ...(projectBrainIndexWorkerService ? { projectBrainIndexWorkerService } : {}),
    ...(taskMemorySummaryService ? { memorySummaryService: taskMemorySummaryService } : {}),
  });
  const coordinationIntervalMs = Number(process.env.AGORA_COORDINATION_RECONCILE_MS ?? 3_000);
  let coordinationTimer: NodeJS.Timeout | null = setInterval(() => {
    try {
      coordinationService.reconcileActiveRuns();
    } catch (error) {
      console.error('[agora] coordination reconciliation failed', error);
    }
  }, coordinationIntervalMs);
  coordinationTimer.unref?.();
  const stopCoordinationReconciliation = () => {
    if (coordinationTimer) {
      clearInterval(coordinationTimer);
      coordinationTimer = null;
    }
  };
  const planningSyncIntervalMs = parseOptionalInt(process.env.PLANNING_SYNC_INTERVAL_MS);
  let planningSyncRunning = false;
  let planningSyncTimer: NodeJS.Timeout | null = planningSyncIntervalMs !== null && planningSyncIntervalMs > 0
    ? setInterval(() => {
        if (planningSyncRunning) return;
        planningSyncRunning = true;
        void planningSyncService.syncAll()
          .catch((error: unknown) => console.error('[agora] planning sync tick failed', error))
          .finally(() => { planningSyncRunning = false; });
      }, planningSyncIntervalMs)
    : null;
  planningSyncTimer?.unref?.();
  const stopPlanningSync = () => {
    if (planningSyncTimer) {
      clearInterval(planningSyncTimer);
      planningSyncTimer = null;
    }
  };
  const closeDatabase = db.close;
  db.close = () => {
    stopCoordinationReconciliation();
    stopPlanningSync();
    closeDatabase();
  };
  const dispose = () => {
    composition.ccConnectSessionMirrorService?.stop();
    composition.ccConnectBridgeRuntimeService?.stop();
    composition.discordThreadIngressService?.stop();
    composition.discordPresenceService?.stop();
    observationScheduler.stop();
    stopCoordinationReconciliation();
    stopPlanningSync();
  };

  return {
    config: config as AgoraConfig,
    db,
    ...composition,
    ...(calendarService ? { calendarService } : {}),
    planningService,
    planningSyncService,
    actionAuditService,
    runtimeTargetService,
    coordinationService,
    artifactService,
    memoryService,
    ...(taskMemorySummaryService ? { taskMemorySummaryService } : {}),
    routineService,
    runtimeNodeCredentialService,
    mergeCoordinatorService,
    a2aGatewayService,
    apiAuth: config.api_auth,
    dashboardAuth: {
      enabled: config.dashboard_auth.enabled,
      method: config.dashboard_auth.method,
      allowedUsers: config.dashboard_auth.allowed_users,
      password: process.env.AGORA_DASHBOARD_BASIC_PASSWORD ?? null,
      sessionTtlHours: config.dashboard_auth.session_ttl_hours,
    },
    rateLimit: {
      enabled: config.rate_limit.enabled,
      windowMs: config.rate_limit.window_ms,
      maxRequests: config.rate_limit.max_requests,
      writeMaxRequests: config.rate_limit.write_max_requests,
    },
    observability: config.observability,
    projectBrainDoctorService,
    dashboardDir: resolveDashboardDir(),
    observationScheduler,
    discordPresenceService: composition.discordPresenceService,
    dispose,
  };
}
