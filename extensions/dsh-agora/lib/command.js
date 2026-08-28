import { randomUUID } from 'node:crypto';
export class AgoraCommandParseError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AgoraCommandParseError';
    }
}
const USAGE = [
    'Agora commands:',
    '/agora health',
    '/agora nodes',
    '/agora agents',
    '/agora list [--state <state>] [--project <project-id>]',
    '/agora show <task-id>',
    '/agora status <task-id>',
    '/agora dispatch-status <dispatch-id>',
    '/agora runs',
    '/agora run-status <run-id>',
    '/agora scorecards [task-type]',
    '/agora run --mode fanout --agents <target,target,...> [--max-agents N] [--max-dispatches N] [--max-seconds N] <prompt>',
    '/agora create [--type <type>] [--priority low|normal|high] [--project <id>] <title>',
    '/agora dashboard',
    '/agora im',
    '',
    'Human approval and rejection remain in the authenticated Agora surface.',
].join('\n');
export function parseAgoraCommand(rawInput) {
    const tokens = tokenize(rawInput);
    const verb = tokens.shift()?.toLowerCase() ?? 'help';
    switch (verb) {
        case 'help':
        case '--help':
        case '-h':
            noArguments(tokens, verb);
            return { kind: 'help' };
        case 'health':
            noArguments(tokens, verb);
            return { kind: 'health' };
        case 'nodes':
        case 'agents':
            noArguments(tokens, verb);
            return { kind: verb };
        case 'dashboard':
            noArguments(tokens, verb);
            return { kind: 'dashboard' };
        case 'im':
            noArguments(tokens, verb);
            return { kind: 'im' };
        case 'show':
            return { kind: 'show', taskId: oneArgument(tokens, 'show') };
        case 'status':
            return { kind: 'status', taskId: oneArgument(tokens, 'status') };
        case 'dispatch-status':
            return { kind: 'dispatch-status', dispatchId: oneArgument(tokens, 'dispatch-status') };
        case 'runs':
            noArguments(tokens, verb);
            return { kind: 'runs' };
        case 'run-status':
            return { kind: 'run-status', runId: oneArgument(tokens, 'run-status') };
        case 'scorecards':
            if (tokens.length > 1)
                throw new AgoraCommandParseError('scorecards accepts at most one task type');
            return { kind: 'scorecards', ...(tokens[0] ? { taskType: tokens[0] } : {}) };
        case 'run': {
            const flags = parseFlags(tokens, new Set(['mode', 'agents', 'task-type', 'max-agents', 'max-dispatches', 'max-seconds']));
            const prompt = flags.positionals.join(' ').trim();
            if (!prompt)
                throw new AgoraCommandParseError('run requires a prompt');
            const mode = parseCoordinationMode(flags.values.mode);
            const runtimeTargets = (flags.values.agents ?? '').split(',').map(value => value.trim()).filter(Boolean);
            if (runtimeTargets.length === 0)
                throw new AgoraCommandParseError('run requires --agents <target,target,...>');
            return { kind: 'run', input: {
                    mode,
                    runtimeTargets,
                    prompt,
                    taskType: flags.values['task-type']?.trim() || 'general',
                    ...optionalPositiveInteger(flags.values['max-agents'], 'max-agents'),
                    ...optionalPositiveInteger(flags.values['max-dispatches'], 'max-dispatches'),
                    ...optionalPositiveInteger(flags.values['max-seconds'], 'max-seconds'),
                } };
        }
        case 'list': {
            const flags = parseFlags(tokens, new Set(['state', 'project']));
            if (flags.positionals.length > 0)
                throw new AgoraCommandParseError('list only accepts --state and --project');
            return {
                kind: 'list',
                ...(flags.values.state === undefined ? {} : { state: flags.values.state }),
                ...(flags.values.project === undefined ? {} : { projectId: flags.values.project }),
            };
        }
        case 'create': {
            const flags = parseFlags(tokens, new Set(['type', 'priority', 'project']));
            const title = flags.positionals.join(' ').trim();
            if (title === '')
                throw new AgoraCommandParseError('create requires a task title');
            const priority = parsePriority(flags.values.priority);
            return {
                kind: 'create',
                input: {
                    title,
                    ...(flags.values.type === undefined ? {} : { type: flags.values.type }),
                    ...(priority === undefined ? {} : { priority }),
                    ...(flags.values.project === undefined ? {} : { projectId: flags.values.project }),
                },
            };
        }
        default:
            throw new AgoraCommandParseError(`unknown Agora command "${verb}"`);
    }
}
export async function executeAgoraCommand(service, rawInput, context = {}, signal) {
    let command;
    try {
        command = parseAgoraCommand(rawInput);
    }
    catch (error) {
        return { kind: 'error', text: `${messageOf(error)}\n\n${USAGE}` };
    }
    try {
        switch (command.kind) {
            case 'help': return { kind: 'success', text: USAGE };
            case 'dashboard': return { kind: 'success', text: `${service.serverUrl}/dashboard/` };
            case 'im': return { kind: 'success', text: formatImStatus(service.snapshot()) };
            case 'health': {
                const health = await service.health(signal);
                const label = health.service ?? health.status ?? (health.ok === false ? 'unhealthy' : 'online');
                return { kind: 'success', text: `Agora: ${String(label)}\nServer: ${service.serverUrl}` };
            }
            case 'nodes': {
                const nodes = await service.listRuntimeNodes(signal);
                return {
                    kind: 'success',
                    text: nodes.length === 0 ? 'No DSH runtime nodes registered.' : nodes.map(node => (`${node.node_id}  [${node.presence}]  agents=${node.agents.length} bots=${node.bots.filter(bot => bot.connected).length}/${node.bots.length}`)).join('\n'),
                };
            }
            case 'agents': {
                const targets = (await service.listRuntimeTargets(signal)).filter(target => target.runtime_provider === 'dsh');
                return {
                    kind: 'success',
                    text: targets.length === 0 ? 'No DSH runtime agents registered.' : targets.map(target => (`${target.runtime_target_ref}  ${target.primary_model ?? '-'}  [${target.presentation_mode}]`)).join('\n'),
                };
            }
            case 'list': return { kind: 'success', text: formatTaskList(await service.listTasks(command.state, command.projectId, signal)) };
            case 'show': return { kind: 'success', text: formatTask(await service.getTask(command.taskId, signal)) };
            case 'status': return { kind: 'success', text: formatStatus(await service.taskStatus(command.taskId, signal)) };
            case 'dispatch-status': {
                const dispatch = await service.getRuntimeDispatch(command.dispatchId, signal);
                const progress = await service.listRuntimeDispatchProgress(command.dispatchId, signal);
                const latest = dispatch.latest_progress ?? progress.at(-1) ?? null;
                const envelope = dispatch.result_envelope;
                return {
                    kind: dispatch.status === 'failed' ? 'error' : 'success',
                    text: [
                        `${dispatch.id}: ${dispatch.status}`,
                        `Target: ${dispatch.runtime_target_ref}`,
                        `Session: ${dispatch.session_id ?? '-'}`,
                        `Lease heartbeat: ${dispatch.claim_renewed_at ?? '-'}`,
                        `Work progress: ${latest ? `${latest.phase} (#${latest.attempt}.${latest.sequence})${latest.percent === null || latest.percent === undefined ? '' : ` ${latest.percent}%`}` : '-'}`,
                        ...(latest?.message ? [`Progress detail: ${latest.message}`] : []),
                        ...(envelope ? [
                            `Evidence: ${envelope.evidence.length} item(s), ${envelope.claims.length} claim(s)`,
                            ...(envelope.confidence === null || envelope.confidence === undefined ? [] : [`Confidence: ${Math.round(envelope.confidence * 100)}%`]),
                        ] : []),
                        ...(dispatch.error ? [`Error: ${dispatch.error}`] : []),
                    ].join('\n'),
                };
            }
            case 'runs': {
                const runs = await service.listCoordinationRuns(undefined, signal);
                return { kind: 'success', text: runs.length === 0 ? 'No coordination runs.' : runs.map(formatRunLine).join('\n') };
            }
            case 'run-status': return { kind: 'success', text: formatRun(await service.getCoordinationRun(command.runId, signal)) };
            case 'scorecards': {
                const cards = await service.listAgentScorecards(command.taskType, signal);
                return { kind: 'success', text: cards.length === 0 ? 'No Agent scorecard observations.' : cards.map(card => (`${card.runtime_target_ref} [${card.task_type}] score=${card.score.toFixed(1)} observations=${card.observations} success=${formatRatio(card.success_rate)} p95=${card.p95_duration_ms ?? '-'}ms evidence=${card.evidence_yield?.toFixed(2) ?? '-'}`)).join('\n') };
            }
            case 'run': {
                const budget = {
                    ...(command.input.maxAgents === undefined ? {} : { max_agents: command.input.maxAgents }),
                    ...(command.input.maxDispatches === undefined ? {} : { max_dispatches: command.input.maxDispatches }),
                    ...(command.input.maxSeconds === undefined ? {} : { max_wall_clock_seconds: command.input.maxSeconds }),
                };
                const run = await service.createCoordinationRun({
                    mode: command.input.mode,
                    prompt: command.input.prompt,
                    task_type: command.input.taskType,
                    candidates: command.input.runtimeTargets.map(runtime_target_ref => ({ runtime_target_ref })),
                    ...(Object.keys(budget).length === 0 ? {} : { budget }),
                    idempotency_key: `dsh-command:${randomUUID()}`,
                    metadata: context.actorId ? { requested_by: context.actorId } : null,
                }, signal);
                return { kind: 'success', text: `Created coordination run ${run.id}\n${formatRun(run)}` };
            }
            case 'create': {
                const task = await service.createTask({
                    ...command.input,
                    ...(context.actorId === undefined ? {} : { creator: context.actorId }),
                    ...imTargetFrom(context),
                }, signal);
                return { kind: 'success', text: `Created ${task.id}: ${task.title}\nState: ${task.state}\nStage: ${task.current_stage ?? '-'}` };
            }
        }
    }
    catch (error) {
        return { kind: 'error', text: messageOf(error) };
    }
}
function formatTaskList(tasks) {
    if (tasks.length === 0)
        return 'No Agora tasks matched.';
    return tasks.map(task => `${task.id}  [${task.state}]  ${task.title}${task.current_stage ? `  (${task.current_stage})` : ''}`).join('\n');
}
function formatTask(task) {
    return [
        `${task.id}: ${task.title}`,
        `State: ${task.state}`,
        `Stage: ${task.current_stage ?? '-'}`,
        `Type: ${task.type}`,
        `Priority: ${task.priority}`,
        `Project: ${task.project_id ?? '-'}`,
        ...(task.error_detail ? [`Error: ${task.error_detail}`] : []),
    ].join('\n');
}
function formatStatus(status) {
    return [
        formatTask(status.task),
        `Subtasks: ${status.subtasks.length}`,
        `Flow events: ${status.flow_log.length}`,
        `Progress entries: ${status.progress_log.length}`,
    ].join('\n');
}
function formatRunLine(run) {
    return `${run.id} [${run.status}] ${run.mode} members=${run.members.length} ${run.stop_reason ?? ''}`.trim();
}
function formatRun(run) {
    return [
        formatRunLine(run),
        `Deadline: ${run.deadline_at}`,
        `Usage: tokens=${run.usage.total_tokens ?? '-'} tools=${run.usage.tool_calls ?? '-'} cost=${run.usage.cost_usd ?? '-'}`,
        `Evidence: ${run.synthesis?.evidence_ids.length ?? 0}; conflicts: ${run.synthesis?.conflicts.length ?? 0}; verified: ${run.synthesis?.verified ?? false}`,
        ...run.members.map(member => `- r${member.round} ${member.role} ${member.runtime_target_ref}: ${member.status} score=${member.selection_score.toFixed(1)}`),
        ...(run.synthesis?.answer ? ['', run.synthesis.answer] : []),
    ].join('\n');
}
function formatImStatus(snapshot) {
    const adapter = `First-party command adapter: ${snapshot.commandAdapter.state} (${snapshot.commandAdapter.protocol})`;
    const gateway = snapshot.im.state === 'connected'
        ? `Command gateway: connected (${snapshot.im.service}, ${snapshot.im.protocol})`
        : `Command gateway: ${snapshot.im.state} (${snapshot.im.reason})`;
    const bridge = snapshot.imBridge.state === 'connected'
        ? `IM bridge: connected (${snapshot.imBridge.service}, ${snapshot.imBridge.protocol})`
        : `IM bridge: ${snapshot.imBridge.state} (${snapshot.imBridge.reason})`;
    const node = snapshot.node.state === 'online'
        ? `Runtime node: online (${snapshot.node.nodeId})`
        : snapshot.node.state === 'error'
            ? `Runtime node: error (${snapshot.node.nodeId}, ${snapshot.node.error})`
            : `Runtime node: ${snapshot.node.state} (${snapshot.node.nodeId})`;
    return [adapter, gateway, bridge, node, `Extensions: ${snapshot.extensions.map(item => item.id).join(', ') || '-'}`].join('\n');
}
function imTargetFrom(context) {
    if (context.provider === undefined && context.conversationRef === undefined && context.threadRef === undefined)
        return {};
    return {
        imTarget: {
            ...(context.provider === undefined ? {} : { provider: context.provider }),
            ...(context.conversationRef === undefined ? {} : { conversation_ref: context.conversationRef }),
            ...(context.threadRef === undefined ? {} : { thread_ref: context.threadRef }),
        },
    };
}
function parsePriority(value) {
    if (value === undefined)
        return undefined;
    if (value === 'low' || value === 'normal' || value === 'high')
        return value;
    throw new AgoraCommandParseError('priority must be low, normal, or high');
}
function parseCoordinationMode(value) {
    if (value === 'single' || value === 'fanout' || value === 'review' || value === 'debate' || value === 'council')
        return value;
    throw new AgoraCommandParseError('run requires --mode single|fanout|review|debate|council');
}
function optionalPositiveInteger(value, field) {
    if (value === undefined)
        return {};
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0)
        throw new AgoraCommandParseError(`--${field} must be a positive integer`);
    const key = field === 'max-agents' ? 'maxAgents' : field === 'max-dispatches' ? 'maxDispatches' : 'maxSeconds';
    return { [key]: parsed };
}
function formatRatio(value) { return value === null ? '-' : `${Math.round(value * 100)}%`; }
function oneArgument(tokens, verb) {
    if (tokens.length !== 1)
        throw new AgoraCommandParseError(`${verb} requires exactly one task id`);
    return tokens[0];
}
function noArguments(tokens, verb) {
    if (tokens.length > 0)
        throw new AgoraCommandParseError(`${verb} does not accept arguments`);
}
function parseFlags(tokens, allowed) {
    const values = {};
    const positionals = [];
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (!token.startsWith('--')) {
            positionals.push(token);
            continue;
        }
        const name = token.slice(2);
        if (!allowed.has(name))
            throw new AgoraCommandParseError(`unknown option --${name}`);
        if (values[name] !== undefined)
            throw new AgoraCommandParseError(`option --${name} was supplied more than once`);
        const value = tokens[index + 1];
        if (value === undefined || value.startsWith('--'))
            throw new AgoraCommandParseError(`option --${name} requires a value`);
        values[name] = value;
        index += 1;
    }
    return { values, positionals };
}
function tokenize(input) {
    const tokens = [];
    let token = '';
    let quote;
    let escaped = false;
    let started = false;
    for (const char of input.trim()) {
        if (escaped) {
            token += char;
            escaped = false;
            started = true;
            continue;
        }
        if (char === '\\' && quote !== 'single') {
            escaped = true;
            started = true;
            continue;
        }
        if (char === "'" && quote !== 'double') {
            quote = quote === 'single' ? undefined : 'single';
            started = true;
            continue;
        }
        if (char === '"' && quote !== 'single') {
            quote = quote === 'double' ? undefined : 'double';
            started = true;
            continue;
        }
        if (/\s/u.test(char) && quote === undefined) {
            if (started)
                tokens.push(token);
            token = '';
            started = false;
            continue;
        }
        token += char;
        started = true;
    }
    if (escaped)
        throw new AgoraCommandParseError('unfinished escape at end of command');
    if (quote !== undefined)
        throw new AgoraCommandParseError('unclosed quote in command');
    if (started)
        tokens.push(token);
    return tokens;
}
function messageOf(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=command.js.map