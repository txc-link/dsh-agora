window.__ModuleLoader__.load({ id: 'dsh-agora', factory: (require) => {
  'use strict'
  var module = { exports: {} }
  var exports = module.exports
  const React = require('react')

  const API_PREFIX = '/dsh-agora/api/'
  const POLL_MS = 5000
  const TAB_ID = 'dsh-agora:dashboard'
  const FIRST_OPEN_KEY = 'dsh-agora:dashboard:auto-opened:v1'

  async function rpc(method, payload) {
    const response = await fetch(API_PREFIX + method, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    })
    let body
    try { body = await response.json() } catch (error) {
      throw new Error('Agora API returned invalid JSON (HTTP ' + response.status + ')')
    }
    if (!response.ok || body?.ok !== true) {
      throw new Error(body?.error?.message || ('Agora API failed (HTTP ' + response.status + ')'))
    }
    return body.value
  }

  function AgoraIcon(props) {
    const size = props?.size || 16
    return React.createElement('svg', {
      width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
      stroke: 'currentColor', strokeWidth: 1.35, strokeLinecap: 'round',
      strokeLinejoin: 'round', 'aria-hidden': true,
    },
    React.createElement('circle', { cx: 8, cy: 8, r: 2.1 }),
    React.createElement('circle', { cx: 3, cy: 4, r: 1.5 }),
    React.createElement('circle', { cx: 13, cy: 4, r: 1.5 }),
    React.createElement('circle', { cx: 3, cy: 12, r: 1.5 }),
    React.createElement('circle', { cx: 13, cy: 12, r: 1.5 }),
    React.createElement('path', { d: 'M4.3 4.8 6.2 6.4M11.7 4.8 9.8 6.4M4.3 11.2 6.2 9.6M11.7 11.2 9.8 9.6' }))
  }

  function openAgora(sidebar) {
    if (!sidebar || typeof sidebar.openTab !== 'function') return
    // A content seed makes better-sidebar expand whichever panel owns the tab.
    sidebar.openTab({ type: TAB_ID, path: 'dsh-agora://dashboard' })
  }

  function shouldAutoOpen() {
    if (typeof window === 'undefined' || !window.sessionStorage) return false
    try {
      if (window.sessionStorage.getItem(FIRST_OPEN_KEY) === '1') return false
      window.sessionStorage.setItem(FIRST_OPEN_KEY, '1')
      return true
    } catch (error) {
      return false
    }
  }

  function installLauncher(sidebar) {
    if (typeof document === 'undefined' || !document.body) return function () {}
    const old = document.querySelector('[data-dsh-agora-launcher]')
    if (old) old.remove()
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'da-launcher'
    button.setAttribute('data-dsh-agora-launcher', '')
    button.setAttribute('aria-label', '打开 Agora 协同')
    button.setAttribute('title', '打开 Agora 协同')
    const icon = document.createElement('span')
    icon.className = 'da-launcher-icon'
    icon.setAttribute('aria-hidden', 'true')
    icon.textContent = '⬡'
    const label = document.createElement('span')
    label.className = 'da-launcher-label'
    label.textContent = 'Agora'
    button.append(icon, label)
    const onClick = function () { openAgora(sidebar) }
    button.addEventListener('click', onClick)
    document.body.appendChild(button)
    return function () {
      button.removeEventListener('click', onClick)
      button.remove()
    }
  }

  function text(value, fallback) {
    return typeof value === 'string' && value.trim() ? value : (fallback || '—')
  }

  function list(value) {
    return Array.isArray(value) ? value : []
  }

  function shortTime(value) {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
  }

  function statusClass(value) {
    const normalized = String(value || '').toLowerCase()
    if (['ok', 'online', 'connected', 'completed', 'enabled'].includes(normalized)) return ' da-ok'
    if (['failed', 'offline', 'error', 'cancelled', 'incompatible'].includes(normalized)) return ' da-bad'
    return ' da-warn'
  }

  function Badge(props) {
    return React.createElement('span', { className: 'da-badge' + statusClass(props.value) }, text(props.value))
  }

  function Empty(props) {
    return React.createElement('div', { className: 'da-empty' }, props.children)
  }

  function SectionTitle(props) {
    return React.createElement('div', { className: 'da-section-title' },
      React.createElement('strong', null, props.title),
      props.note ? React.createElement('span', null, props.note) : null)
  }

  function Overview(props) {
    const snapshot = props.snapshot || {}
    const nodes = props.nodes
    const agents = props.agents
    const bots = nodes.flatMap(function (node) { return list(node.bots) })
    const active = nodes.reduce(function (sum, node) { return sum + Number(node.capacity?.active || 0) }, 0)
    const capacity = nodes.reduce(function (sum, node) { return sum + Number(node.capacity?.max_concurrent || 0) }, 0)
    return React.createElement('div', { className: 'da-scroll' },
      React.createElement('div', { className: 'da-metrics' },
        React.createElement('div', { className: 'da-metric' }, React.createElement('b', null, nodes.length), React.createElement('span', null, '节点')),
        React.createElement('div', { className: 'da-metric' }, React.createElement('b', null, agents.length), React.createElement('span', null, 'Agent')),
        React.createElement('div', { className: 'da-metric' }, React.createElement('b', null, bots.filter(function (bot) { return bot.connected }).length), React.createElement('span', null, '在线 Bot')),
        React.createElement('div', { className: 'da-metric' }, React.createElement('b', null, active + '/' + capacity), React.createElement('span', null, '执行槽位'))),
      React.createElement('div', { className: 'da-card' },
        SectionTitle({ title: '连接状态', note: text(snapshot.serverUrl) }),
        React.createElement('div', { className: 'da-kv' },
          React.createElement('span', null, '本机节点'), Badge({ value: snapshot.node?.state || 'unknown' }),
          React.createElement('span', null, 'dsh-im 桥'), Badge({ value: snapshot.imBridge?.state || 'unavailable' }),
          React.createElement('span', null, '最近心跳'), React.createElement('code', null, shortTime(snapshot.node?.lastHeartbeatAt)),
          React.createElement('span', null, '扩展协议'), React.createElement('code', null, list(snapshot.extensions).map(function (item) { return item.id }).join(', ') || '—'))),
      React.createElement('div', { className: 'da-card' },
        SectionTitle({ title: '通信方式', note: 'Discord 只负责呈现，Agent 通过持久派发队列协作' }),
        React.createElement('div', { className: 'da-flow' },
          React.createElement('span', null, 'IM / DSH Session'), React.createElement('i', null, '→'),
          React.createElement('span', null, 'Agora Queue'), React.createElement('i', null, '→'),
          React.createElement('span', null, '目标 Agent'))))
  }

  function Nodes(props) {
    if (!props.nodes.length) return Empty({ children: '尚未发现运行时节点。' })
    return React.createElement('div', { className: 'da-scroll da-stack' }, props.nodes.map(function (node) {
      return React.createElement('article', { className: 'da-card', key: node.node_id },
        React.createElement('div', { className: 'da-card-head' },
          React.createElement('div', null, React.createElement('strong', null, text(node.node_id)), React.createElement('small', null, text(node.host_framework))),
          Badge({ value: node.presence })),
        React.createElement('div', { className: 'da-inline-meta' },
          React.createElement('span', null, '版本 ', text(node.plugin_version)),
          React.createElement('span', null, '容量 ', Number(node.capacity?.active || 0) + '/' + Number(node.capacity?.max_concurrent || 0)),
          React.createElement('span', null, '心跳 ', shortTime(node.last_seen_at))),
        React.createElement('div', { className: 'da-subtitle' }, 'Agents'),
        list(node.agents).map(function (agent) {
          return React.createElement('div', { className: 'da-row', key: agent.agent_ref },
            React.createElement('span', null, React.createElement('b', null, text(agent.display_name, agent.agent_ref)), React.createElement('code', null, agent.agent_ref)),
            React.createElement('small', null, list(agent.capabilities).join(' · ') || '无能力标签'))
        }),
        React.createElement('div', { className: 'da-subtitle' }, 'Bots'),
        list(node.bots).length ? list(node.bots).map(function (bot) {
          return React.createElement('div', { className: 'da-row', key: bot.provider + ':' + bot.bot_ref },
            React.createElement('span', null, React.createElement('b', null, text(bot.display_name, bot.bot_ref)), React.createElement('code', null, bot.provider)),
            Badge({ value: bot.connected ? 'connected' : 'offline' }))
        }) : React.createElement('small', { className: 'da-muted' }, '此节点没有 IM Bot'))
    }))
  }

  function Tasks(props) {
    const [title, setTitle] = React.useState('')
    const [description, setDescription] = React.useState('')
    const [saving, setSaving] = React.useState(false)
    async function createTask(event) {
      event.preventDefault()
      if (!title.trim() || saving) return
      setSaving(true)
      try {
        await rpc('create', { title: title.trim(), description: description.trim() || undefined, creator: 'dsh-ui' })
        setTitle(''); setDescription(''); await props.reload()
      } catch (error) { props.onError(error) } finally { setSaving(false) }
    }
    return React.createElement('div', { className: 'da-scroll da-stack' },
      React.createElement('form', { className: 'da-card da-form', onSubmit: createTask },
        SectionTitle({ title: '创建协作任务', note: '任务持久保存在中央 Agora' }),
        React.createElement('input', { value: title, placeholder: '任务标题', onChange: function (event) { setTitle(event.target.value) } }),
        React.createElement('textarea', { value: description, rows: 3, placeholder: '目标、约束或验收标准（可选）', onChange: function (event) { setDescription(event.target.value) } }),
        React.createElement('button', { className: 'da-primary', type: 'submit', disabled: saving || !title.trim() }, saving ? '创建中…' : '创建任务')),
      props.tasks.length ? props.tasks.map(function (task) {
        const id = task.id || task.task_id
        return React.createElement('button', { type: 'button', className: 'da-card da-task', key: id, onClick: function () { props.onSelect(task) } },
          React.createElement('div', { className: 'da-card-head' }, React.createElement('strong', null, text(task.title, id)), Badge({ value: task.state || task.status || 'unknown' })),
          task.description ? React.createElement('p', null, task.description) : null,
          React.createElement('small', null, text(id) + ' · ' + shortTime(task.updated_at || task.created_at)))
      }) : Empty({ children: '暂无任务。创建第一个跨 Agent 协作任务吧。' }))
  }

  function Agents(props) {
    const [target, setTarget] = React.useState(props.agents[0]?.runtime_target_ref || '')
    const [sessionId, setSessionId] = React.useState('')
    const [prompt, setPrompt] = React.useState('')
    const [presentation, setPresentation] = React.useState('silent')
    const [sending, setSending] = React.useState(false)
    React.useEffect(function () {
      if (!target && props.agents[0]?.runtime_target_ref) setTarget(props.agents[0].runtime_target_ref)
    }, [props.agents, target])
    async function dispatch(event) {
      event.preventDefault()
      if (!target || !prompt.trim() || sending) return
      setSending(true)
      try {
        const value = await rpc('dispatch', {
          runtimeTargetRef: target,
          prompt: prompt.trim(),
          idempotencyKey: 'dsh-agora-ui-' + Date.now() + '-' + Math.random().toString(36).slice(2),
          sessionId: sessionId.trim() || undefined,
          presentationMode: presentation,
          waitTimeoutMs: 0,
        })
        props.onDispatch(value)
        if (value?.session_id) setSessionId(value.session_id)
        setPrompt('')
      } catch (error) { props.onError(error) } finally { setSending(false) }
    }
    return React.createElement('div', { className: 'da-scroll da-stack' },
      React.createElement('form', { className: 'da-card da-form', onSubmit: dispatch },
        SectionTitle({ title: '派发 Agent', note: '默认静默执行；主动回帖需明确选择' }),
        React.createElement('label', null, '目标 Agent', React.createElement('select', { value: target, onChange: function (event) { setTarget(event.target.value) } },
          props.agents.map(function (agent) { return React.createElement('option', { value: agent.runtime_target_ref, key: agent.runtime_target_ref }, text(agent.display_name, agent.runtime_target_ref)) }))),
        React.createElement('label', null, '续接 Session（可选）', React.createElement('input', { value: sessionId, placeholder: 'session-…', onChange: function (event) { setSessionId(event.target.value) } })),
        React.createElement('label', null, '结果呈现', React.createElement('select', { value: presentation, onChange: function (event) { setPresentation(event.target.value) } },
          React.createElement('option', { value: 'silent' }, '静默，仅保存在 Agora'),
          React.createElement('option', { value: 'destination_bot' }, '由目标 Bot 回帖'))),
        React.createElement('textarea', { value: prompt, rows: 5, placeholder: '输入要交给目标 Agent 的任务…', onChange: function (event) { setPrompt(event.target.value) } }),
        React.createElement('button', { className: 'da-primary', type: 'submit', disabled: sending || !target || !prompt.trim() }, sending ? '派发中…' : '立即派发')),
      React.createElement('div', { className: 'da-card' },
        SectionTitle({ title: '可用目标', note: props.agents.length + ' 个' }),
        props.agents.length ? props.agents.map(function (agent) {
          return React.createElement('div', { className: 'da-row', key: agent.runtime_target_ref },
            React.createElement('span', null, React.createElement('b', null, text(agent.display_name, agent.runtime_target_ref)), React.createElement('code', null, agent.runtime_target_ref)),
            Badge({ value: agent.enabled === false ? 'disabled' : 'enabled' }))
        }) : React.createElement('small', { className: 'da-muted' }, '没有在线 Agent')),
      props.dispatches.length ? React.createElement('div', { className: 'da-card' },
        SectionTitle({ title: '本页派发记录', note: '刷新页面后仍可从任务记录查询' }),
        props.dispatches.map(function (item, index) {
          return React.createElement('div', { className: 'da-row', key: item?.id || index },
            React.createElement('span', null, React.createElement('b', null, text(item?.runtime_target_ref, 'dispatch')), React.createElement('code', null, text(item?.id))),
            Badge({ value: item?.status || 'submitted' }))
        })) : null)
  }

  function AgoraPanel(props) {
    const [tab, setTab] = React.useState('overview')
    const [snapshot, setSnapshot] = React.useState(null)
    const [nodes, setNodes] = React.useState([])
    const [agents, setAgents] = React.useState([])
    const [tasks, setTasks] = React.useState([])
    const [dispatches, setDispatches] = React.useState([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState('')
    const [updatedAt, setUpdatedAt] = React.useState(null)

    const load = React.useCallback(async function (quiet) {
      if (!quiet) setLoading(true)
      try {
        const values = await Promise.all([rpc('snapshot'), rpc('nodes'), rpc('agents'), rpc('tasks')])
        setSnapshot(values[0]); setNodes(list(values[1])); setAgents(list(values[2])); setTasks(list(values[3]))
        setError(''); setUpdatedAt(new Date())
      } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
      finally { if (!quiet) setLoading(false) }
    }, [])

    React.useEffect(function () {
      if (props.visible === false) return
      load(false)
      const timer = setInterval(function () { load(true) }, POLL_MS)
      return function () { clearInterval(timer) }
    }, [props.visible, load])

    function onError(reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    const tabs = [['overview', '总览'], ['nodes', '节点'], ['tasks', '任务'], ['agents', '派发']]
    let body
    if (loading && !snapshot) body = React.createElement(Empty, null, '正在连接 Agora…')
    else if (tab === 'nodes') body = React.createElement(Nodes, { nodes: nodes })
    else if (tab === 'tasks') body = React.createElement(Tasks, { tasks: tasks, reload: function () { return load(true) }, onError: onError, onSelect: function () {} })
    else if (tab === 'agents') body = React.createElement(Agents, { agents: agents, dispatches: dispatches, onError: onError, onDispatch: function (value) { setDispatches(function (items) { return [value].concat(items).slice(0, 12) }) } })
    else body = React.createElement(Overview, { snapshot: snapshot, nodes: nodes, agents: agents })

    return React.createElement('div', { className: 'da-root' },
      React.createElement('header', { className: 'da-header' },
        React.createElement('div', null, React.createElement('strong', null, 'Agora'), React.createElement('small', null, '多 Agent 协同中心')),
        React.createElement('button', { type: 'button', title: '立即刷新', onClick: function () { load(false) } }, '↻')),
      React.createElement('nav', { className: 'da-tabs' }, tabs.map(function (item) {
        return React.createElement('button', { type: 'button', key: item[0], className: tab === item[0] ? 'active' : '', onClick: function () { setTab(item[0]) } }, item[1])
      })),
      error ? React.createElement('div', { className: 'da-error' }, React.createElement('span', null, error), React.createElement('button', { type: 'button', onClick: function () { setError('') } }, '×')) : null,
      body,
      React.createElement('footer', { className: 'da-footer' },
        React.createElement('span', null, snapshot?.node?.nodeId || '未连接节点'),
        React.createElement('span', null, updatedAt ? '更新于 ' + updatedAt.toLocaleTimeString() : '等待数据')))
  }

  const CSS = [
    '.da-root{box-sizing:border-box;height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);font-size:13px;pointer-events:auto}',
    '.da-root *{box-sizing:border-box}',
    '.da-launcher{position:fixed;z-index:90;top:6px;right:46px;height:28px;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);display:inline-flex;align-items:center;gap:5px;padding:0 8px;cursor:pointer;font:inherit;font-size:11px;box-shadow:var(--dsw-shadow-lv1)}.da-launcher:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-brand-primary)}.da-launcher-icon{font-size:17px;line-height:1}.da-launcher-label{display:inline}@media(max-width:767px){.da-launcher{width:28px;padding:0;justify-content:center}.da-launcher-label{display:none}}',
    '.da-header{height:44px;flex:none;padding:0 9px 0 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--dsw-alias-border-l1)}',
    '.da-header>div{display:flex;flex-direction:column;line-height:17px}.da-header strong{font-size:14px}.da-header small,.da-muted{color:var(--dsw-alias-label-dimmed);font-size:11px}',
    '.da-header button,.da-error button{border:0;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:50%;width:28px;height:28px;font-size:18px}.da-header button:hover,.da-error button:hover{background:var(--dsw-alias-interactive-bg-hover)}',
    '.da-tabs{height:35px;flex:none;display:grid;grid-template-columns:repeat(4,1fr);padding:3px 6px;border-bottom:1px solid var(--dsw-alias-border-l1);gap:2px}.da-tabs button{border:0;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}.da-tabs button:hover{background:var(--dsw-alias-interactive-bg-hover)}.da-tabs button.active{background:var(--dsw-alias-interactive-bg-active);color:var(--dsw-alias-brand-primary);font-weight:600}',
    '.da-scroll{flex:1;min-height:0;overflow:auto;padding:10px}.da-stack{display:flex;flex-direction:column;gap:8px}',
    '.da-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:8px}.da-metric{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:10px;background:var(--dsw-alias-bg-base);display:flex;flex-direction:column}.da-metric b{font-size:19px;line-height:24px}.da-metric span{font-size:11px;color:var(--dsw-alias-label-dimmed)}',
    '.da-card{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);padding:10px;margin-bottom:8px;color:inherit;text-align:left;width:100%;font:inherit}.da-card-head,.da-section-title{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.da-card-head>div{display:flex;flex-direction:column}.da-card-head small,.da-section-title span{font-size:10px;color:var(--dsw-alias-label-dimmed);font-weight:400}.da-section-title{margin-bottom:9px}.da-section-title strong{font-size:12px}',
    '.da-badge{display:inline-flex;align-items:center;max-width:130px;height:20px;padding:0 7px;border-radius:999px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);font-size:10px;white-space:nowrap}.da-badge.da-ok{color:var(--dsw-alias-state-success-primary)}.da-badge.da-bad{color:var(--dsw-alias-state-error-primary)}.da-badge.da-warn{color:var(--dsw-alias-state-warning-primary,var(--dsw-alias-label-secondary))}',
    '.da-kv{display:grid;grid-template-columns:max-content minmax(0,1fr);align-items:center;gap:7px 10px;font-size:11px}.da-kv>span:nth-child(odd){color:var(--dsw-alias-label-dimmed)}.da-kv code,.da-row code{font:10px var(--dsh-font-mono,ui-monospace,monospace);color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.da-flow{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.da-flow span{padding:5px 7px;border-radius:6px;background:var(--dsw-alias-interactive-bg-hover);font-size:10px}.da-flow i{font-style:normal;color:var(--dsw-alias-label-dimmed)}',
    '.da-inline-meta{display:flex;gap:8px;flex-wrap:wrap;color:var(--dsw-alias-label-dimmed);font-size:10px;margin:8px 0}.da-subtitle{margin:8px 0 3px;text-transform:uppercase;letter-spacing:.08em;font-size:9px;color:var(--dsw-alias-label-dimmed)}',
    '.da-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-top:1px solid var(--dsw-alias-border-l1)}.da-row>span:first-child{display:flex;min-width:0;flex-direction:column}.da-row b{font-size:11px;font-weight:550}.da-row small{font-size:10px;color:var(--dsw-alias-label-dimmed);text-align:right}',
    '.da-form{display:flex;flex-direction:column;gap:7px}.da-form label{display:flex;flex-direction:column;gap:4px;color:var(--dsw-alias-label-secondary);font-size:11px}.da-form input,.da-form textarea,.da-form select{width:100%;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base));color:var(--dsw-alias-label-primary);padding:7px 8px;font:inherit;font-size:12px;outline:none;resize:vertical}.da-form input:focus,.da-form textarea:focus,.da-form select:focus{border-color:var(--dsw-alias-brand-primary)}',
    '.da-primary{height:30px;border:0;border-radius:7px;background:var(--dsw-alias-brand-primary);color:white;font:inherit;font-size:12px;cursor:pointer}.da-primary:disabled{opacity:.5;cursor:not-allowed}.da-task{cursor:pointer}.da-task:hover{border-color:var(--dsw-alias-brand-primary)}.da-task p{margin:7px 0;color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px}.da-task>small{color:var(--dsw-alias-label-dimmed);font-size:9px}',
    '.da-empty{flex:1;min-height:120px;display:flex;align-items:center;justify-content:center;padding:24px;color:var(--dsw-alias-label-dimmed);text-align:center}.da-error{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 8px 6px 10px;background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 12%,transparent);color:var(--dsw-alias-state-error-primary);font-size:11px}.da-error span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.da-footer{height:25px;flex:none;padding:0 10px;border-top:1px solid var(--dsw-alias-border-l1);display:flex;align-items:center;justify-content:space-between;color:var(--dsw-alias-label-dimmed);font-size:9px}',
  ].join('\n')

  function installStyles() {
    if (typeof document === 'undefined') return function () {}
    const old = document.querySelector('style[data-plugin="dsh-agora"]')
    if (old) old.remove()
    const style = document.createElement('style')
    style.setAttribute('data-plugin', 'dsh-agora')
    style.textContent = CSS
    ;(document.head || document.documentElement).appendChild(style)
    return function () { style.remove() }
  }

  function apply(ctx) {
    ctx.effect(function () { return installStyles() }, 'dsh-agora: client styles')
    ctx.plugin({
      inject: ['betterSidebar'],
      apply(sidebarCtx) {
        const sidebar = sidebarCtx.betterSidebar || sidebarCtx.get?.('betterSidebar')
        if (!sidebar || typeof sidebar.registerTab !== 'function') return
        sidebarCtx.effect(function () {
          const unregister = sidebar.registerTab({
            id: TAB_ID,
            title: function () { return 'Agora 协同' },
            icon: function (size) { return React.createElement(AgoraIcon, { size: size }) },
            order: 45,
            single: true,
            component: function (props) { return React.createElement(AgoraPanel, { visible: props.visible, scope: props.scope }) },
          })
          const removeLauncher = installLauncher(sidebar)
          let cancelled = false
          if (shouldAutoOpen()) {
            Promise.resolve().then(function () {
              if (!cancelled) openAgora(sidebar)
            })
          }
          return function () {
            cancelled = true
            removeLauncher()
            unregister()
          }
        }, 'dsh-agora: better-sidebar tab')
      },
    })
  }

  exports.apply = apply
  return module.exports
} })
