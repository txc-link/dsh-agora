/* ════════════════════════════════════════════════════════════════════════════
 * R-F.2 polling — Layer 2 (UI smoke) Playwright spec
 * ════════════════════════════════════════════════════════════════════════════
 *
 * IMPORTANT — This spec is **disabled by default**.
 *
 * The Playwright config (dashboard/playwright.config.ts) only spins up the
 * vite dev server when PLAYWRIGHT_E2E === '1'. Even with the server up,
 * this file gates itself with `test.skip()` so sandbox `npm run test:e2e`
 * exits cleanly with 1 skipped instead of failing on the login screen.
 *
 * To enable (production CI / staging with session auth):
 *   export AGORA_BASE_URL=https://agora.example.com     # real server
 *   export AGORA_ROOT_TOKEN=...                          # root token
 *   # mint an agora_dashboard_session cookie via the real login flow and
 *   # export it as AGORA_DASHBOARD_SESSION_COOKIE; do NOT bake a fake
 *   # session in — the dashboard deliberately requires a real login.
 *   export PLAYWRIGHT_E2E=1
 *   cd dashboard && npm run test:e2e
 *
 * What it covers
 *   - Navigate to /dashboard/projects/{projectId}
 *   - Inject bearer token into `localStorage['agora-settings']` (this is
 *     the same key agora-client.ts reads via readLocalToken())
 *   - Inject the `agora_dashboard_session` cookie (the production login
 *     sets this — see VITE_DASHBOARD_AUTH_COOKIE)
 *   - Click the first task button with `aria-label^="Open task "` (R-F.1
 *     changed these from <Link> to <button>)
 *   - Wait for the <TaskDetailSheet> to render the refresh indicator
 *   - Assert text contains "Last updated" and parses "Xs" where X >= 3
 *   - Wait POLL_INTERVAL_MS (4s) and re-assert the indicator advanced
 *   - Screenshot
 *
 * Why a real task ID and not a fixture
 *   R-F.2 is the *polling* of /api/tasks/:id/conversation. To exercise
 *   that path we need a real task the dashboard can fetch. The spec picks
 *   the first `active` task from /api/tasks and pins it via env override
 *   if you need a deterministic ID.
 * ════════════════════════════════════════════════════════════════════════════ */

import { test, expect, type Page } from '@playwright/test';

const POLL_INTERVAL_MS = 4_000;
const RELATIVE_TICK_MS = 1_000;
const REFRESH_INDICATOR = '[data-testid="task-detail-refresh-indicator"]';
const TASK_BUTTON_SELECTOR = 'button[aria-label^="Open task "]';

const TASK_TITLE = process.env.PLAYWRIGHT_TASK_TITLE ?? 'deploy-verify-23875';

const enabled = process.env.PLAYWRIGHT_E2E === '1';

if (!enabled) {
  // Surface the gate on stderr so `npm run test:e2e` logs explain the
  // 1-skipped result instead of looking like a hidden config bug.
  console.log(
    '[r-f-2-polling.spec] PLAYWRIGHT_E2E !== "1" — skipping. ' +
      'Set PLAYWRIGHT_E2E=1 in an environment where the agora server has ' +
      'AGORA_DASHBOARD_AUTH_ENABLED=true + a real session cookie available.',
  );
}

test.beforeEach(({}, testInfo) => {
  if (!enabled) {
    testInfo.skip(true, 'PLAYWRIGHT_E2E gate off — sandbox skip');
  }
});

async function fetchFirstActiveTask(page: Page): Promise<{ id: string; title: string; projectId: string | null }> {
  // Use page.request so we inherit the same bearer token + base URL.
  const base = (test.info().project.use.baseURL as string | undefined) ?? '';
  const token = process.env.AGORA_ROOT_TOKEN;
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await page.request.get(`${base.replace(/\/dashboard\/?$/, '')}/api/tasks`, {
    headers,
  });
  expect(response.ok(), `task list fetch failed: ${response.status()}`).toBeTruthy();
  const payload = (await response.json()) as { items?: Array<{ id: string; title: string; state: string; project_id?: string | null }> };
  const items = Array.isArray(payload.items) ? payload.items : [];
  const candidate = items.find((it) => it.state === 'active') ?? items[0];
  expect(candidate, 'no tasks on server').toBeTruthy();
  return {
    id: candidate!.id,
    title: candidate!.title,
    projectId: candidate!.project_id ?? null,
  };
}

test('R-F.2 — TaskDetailSheet short poll cycles the refresh indicator', async ({ page, context }) => {
  const cookieName = process.env.VITE_DASHBOARD_AUTH_COOKIE ?? 'agora_dashboard_session';
  const sessionCookie = process.env.AGORA_DASHBOARD_SESSION_COOKIE;
  if (sessionCookie) {
    await context.addCookies([
      {
        name: cookieName,
        value: sessionCookie,
        url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5179',
      },
    ]);
  }

  const rootToken = process.env.AGORA_ROOT_TOKEN;
  if (rootToken) {
    // agora-client reads `agora-settings` and pulls `state.apiToken`.
    await page.addInitScript((token: string) => {
      const payload = {
        state: { apiToken: token, apiBase: '' },
        version: 0,
      };
      window.localStorage.setItem('agora-settings', JSON.stringify(payload));
    }, rootToken);
  }

  const task = await fetchFirstActiveTask(page);
  // Project detail page is the canonical entry point — it mounts
  // <TaskDetailSheet openThreadTaskId={openThreadTaskId}/> at the bottom.
  const projectPath = task.projectId
    ? `/dashboard/projects/${task.projectId}`
    : '/dashboard/projects';

  await page.goto(projectPath);
  await page.waitForLoadState('networkidle');

  const taskButton = page.locator(TASK_BUTTON_SELECTOR, { hasText: new RegExp(task.title, 'i') }).first();
  await expect(taskButton, `task button for ${task.title} not found`).toBeVisible({ timeout: 10_000 });
  await taskButton.click();

  const indicator = page.locator(REFRESH_INDICATOR);
  await expect(indicator, 'refresh indicator missing — TaskDetailSheet did not mount').toBeVisible({
    timeout: 10_000,
  });

  // First read — must already say "Last updated" (the immediate first poll
  // happens inside the effect). Allow up to POLL_INTERVAL_MS for the
  // first successful response so we don't race the immediate poll.
  await expect
    .poll(async () => (await indicator.textContent()) ?? '', {
      timeout: POLL_INTERVAL_MS * 2,
      message: 'refresh indicator never advanced to "Last updated"',
    })
    .toMatch(/Last updated \d+s ago/);

  const firstText = (await indicator.textContent()) ?? '';
  const firstMatch = firstText.match(/Last updated (\d+)s ago/);
  expect(firstMatch, `indicator text "${firstText}" missing counter`).not.toBeNull();
  const firstSeconds = Number(firstMatch![1]);
  expect(firstSeconds, `first counter ${firstSeconds}s should be ≥ 3s`).toBeGreaterThanOrEqual(3);

  // Wait long enough for at least one extra 1Hz tick to bump the relative
  // label, plus a margin for the next poll itself.
  await page.waitForTimeout(POLL_INTERVAL_MS + RELATIVE_TICK_MS + 500);

  const secondText = (await indicator.textContent()) ?? '';
  const secondMatch = secondText.match(/Last updated (\d+)s ago/);
  expect(secondMatch, `indicator text "${secondText}" missing counter after wait`).not.toBeNull();
  const secondSeconds = Number(secondMatch![1]);
  expect(
    secondSeconds,
    `counter should have advanced: first=${firstSeconds}s, second=${secondSeconds}s`,
  ).toBeGreaterThan(firstSeconds);

  await page.screenshot({
    path: `Doc/09-PLANNING/TASKS/2026-08-30-r-f-visual-verify/playwright-report/r-f-2-polling.png`,
    fullPage: true,
  });
});