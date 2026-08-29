/* ════════════════════════════════════════════════════════════════════════════
 * Playwright config — R-F.2 polling Layer 2 (UI smoke) — production deploy asset
 * ════════════════════════════════════════════════════════════════════════════
 *
 * SCOPE — Layer 2 UI smoke for the R-F.2 short polling loop:
 *   1. navigate to /dashboard/projects/{projectId}
 *   2. open <TaskDetailSheet> via the task title button (R-F.1: Link → button)
 *   3. assert [data-testid="task-detail-refresh-indicator"] displays "Last
 *      updated Xs ago" and Xs ≥ 3
 *   4. wait one more poll interval and assert the Xs counter advances
 *   5. screenshot
 *
 * ENABLE GATE — `PLAYWRIGHT_E2E=1`
 *   This config is intentionally inert in the default sandbox:
 *   - the agora server in the sandbox does NOT enable dashboard session
 *     auth (POST /api/dashboard/session/login → 404 "dashboard session auth
 *     is not enabled"), so a real Layer 2 run cannot get past the login
 *     screen without baking an `agora_dashboard_session` cookie from a
 *     production server with `AGORA_DASHBOARD_AUTH_ENABLED=true` +
 *     `AGORA_DASHBOARD_AUTH_METHOD=session` + `AGORA_DASHBOARD_AUTH_PASSWORD`
 *     set. The Layer 1 Node API spec covers the polling contract without
 *     that login wall; the spec here is the *production* check, gated by
 *     PLAYWRIGHT_E2E so it never auto-runs in the local sandbox.
 *   - when PLAYWRIGHT_E2E !== '1', the spec file itself does
 *     `test.skip(...)` with a `console.log` explaining the gate, so the
 *     Playwright runner reports the suite as `1 skipped` instead of an
 *     unexplained 404 on the login page.
 *
 * WORKER / RETRY POLICY — 1 worker, 0 retries, fullyParallel=false.
 *   The polling spec is timing-sensitive: parallel workers and retries
 *   would mask race-protection regressions. CI runs inherit these
 *   defaults; local interactive runs override them via the env gate.
 *
 * REPORT — html report is written to the task_dir under
 *   Doc/09-PLANNING/TASKS/2026-08-30-r-f-visual-verify/playwright-report
 *   so the dashboard test assets never pollute the repo root.
 *
 * DEPS — `@playwright/test` is already declared under devDependencies; the
 *   chromium binary path is `/root/.cache/ms-playwright/chromium-1161/`.
 * ════════════════════════════════════════════════════════════════════════════
 */

import { defineConfig, devices } from '@playwright/test';

const DASHBOARD_PORT = Number(process.env.DASHBOARD_E2E_PORT ?? 5179);
const BASE_URL = `http://127.0.0.1:${DASHBOARD_PORT}/dashboard/`;
const ENABLED = process.env.PLAYWRIGHT_E2E === '1';

// Layer 2 only spins the dev server when the gate is on. In sandbox runs
// (PLAYWRIGHT_E2E unset / !== '1') we skip the spec entirely and never
// start vite, so the suite is a no-op.
const webServer = ENABLED
  ? {
      command: `npm run dev -- --port ${DASHBOARD_PORT} --strictPort`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: 'ignore' as const,
      stderr: 'pipe' as const,
    }
  : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // Always emit a list reporter; only emit the html report when actually
  // running, so sandbox `playwright test --list` exits cleanly.
  reporter: ENABLED
    ? [
        ['list'],
        [
          'html',
          {
            open: 'never',
            outputFolder:
              '../../Doc/09-PLANNING/TASKS/2026-08-30-r-f-visual-verify/playwright-report',
          },
        ],
      ]
    : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: undefined },
    },
  ],
  // Webserver is undefined when disabled → Playwright reports "no tests
  // ran" / "1 skipped" without spawning vite.
  webServer,
  metadata: {
    layer: 'L2-ui',
    rFeature: 'R-F.2 polling',
    taskDir: 'Doc/09-PLANNING/TASKS/2026-08-30-r-f-visual-verify',
    enabled: ENABLED,
  },
});