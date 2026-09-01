import { buildApp } from './app.js';
import { createServerRuntime } from './runtime.js';
import { resolveAgoraRuntimeEnvironmentFromConfigPackage } from '@agora-ts/config';

export function createAppFromRuntime(runtime: ReturnType<typeof createServerRuntime>) {
  const app = buildApp({
    db: runtime.db,
    taskService: runtime.taskService,
    projectService: runtime.projectService,
    projectBrainService: runtime.projectBrainService,
    projectContextDeliveryService: runtime.projectContextDeliveryService,
    contextRetrievalService: runtime.contextRetrievalService,
    contextMaterializationService: runtime.contextMaterializationService,
    projectBrainDoctorService: runtime.projectBrainDoctorService,
    flowLogRepository: runtime.flowLogRepository,
    progressLogRepository: runtime.progressLogRepository,
    citizenService: runtime.citizenService,
    dashboardQueryService: runtime.dashboardQueryService,
    runtimeTargetService: runtime.runtimeTargetService,
    runtimeNodeRegistryService: runtime.runtimeNodeRegistryService,
    coordinationService: runtime.coordinationService,
    artifactService: runtime.artifactService,
    memoryService: runtime.memoryService,
    runtimeNodeCredentialService: runtime.runtimeNodeCredentialService,
    mergeCoordinatorService: runtime.mergeCoordinatorService,
    a2aGatewayService: runtime.a2aGatewayService,
    inboxService: runtime.inboxService,
    templateAuthoringService: runtime.templateAuthoringService,
    liveSessionStore: runtime.liveSessionStore,
    legacyRuntimeService: runtime.legacyRuntimeService,
    taskContextBindingService: runtime.taskContextBindingService,
    taskConversationService: runtime.taskConversationService,
    taskInboundService: runtime.taskInboundService,
    inboxReplyService: runtime.inboxReplyService,
    taskParticipationService: runtime.taskParticipationService,
    humanAccountService: runtime.humanAccountService,
    notificationDispatcher: runtime.notificationDispatcher,
    taskCreatedNotify: {
      enabled:
        runtime.config?.im?.provider === 'matrix'
          ? runtime.config.im.matrix?.notify_on_task_create !== false
          : runtime.config?.im?.provider === 'discord'
            ? runtime.config.im.discord?.notify_on_task_create !== false
            : false,
    },
    apiAuth: runtime.apiAuth,
    dashboardAuth: runtime.dashboardAuth,
    rateLimit: runtime.rateLimit,
    observability: {
      readyPath: runtime.observability.ready_path,
      metricsEnabled: runtime.observability.metrics_enabled,
      structuredLogs: runtime.observability.structured_logs,
      backgroundMetrics: runtime.observationScheduler,
    },
    ...(runtime.imProvisioningPort ? { imProvisioningPort: runtime.imProvisioningPort } : {}),
    ...(runtime.dashboardDir ? { dashboardDir: runtime.dashboardDir } : {}),
    ...(runtime.calendarService ? { calendarService: runtime.calendarService } : {}),
    planningService: runtime.planningService,
  });
  app.addHook('onClose', async () => {
    await runtime.dispose?.();
  });
  return app;
}

async function start() {
  const runtime = createServerRuntime();
  const environment = resolveAgoraRuntimeEnvironmentFromConfigPackage();
  const app = createAppFromRuntime(runtime);
  const port = Number(process.env.PORT ?? environment.backendPort);
  const host = process.env.HOST ?? process.env.AGORA_SERVER_HOST ?? environment.host;

  try {
    await app.listen({ port, host });
    app.log.info(`agora-ts server listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

void start();
