import { describe, expect, it } from 'vitest';
import { loadCcConnectProjectTargets } from './config-targets.js';

/**
 * Matrix platform type RED tests.
 *
 * Spec contract (per task_plan.md Phase 1):
 *   - `type = "matrix"` under [[projects.platforms]] MUST be recognized as a
 *     channel provider for the project.
 *   - Matrix and Discord MAY coexist under the same project.
 *   - Existing Discord token decoding path MUST continue to work unchanged.
 */
describe('cc-connect config matrix platform type', () => {
  it('recognises type = "matrix" under [[projects.platforms]] as a channel provider', () => {
    const targets = loadCcConnectProjectTargets({
      env: { AGORA_CC_CONNECT_CONFIG_PATHS: '/tmp/matrix-only.toml' },
      exists: () => true,
      readFile: () => `
[[projects]]
name = "agora-matrix"

[projects.agent]
type = "codex"

[[projects.platforms]]
type = "matrix"
`,
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]?.projectName).toBe('agora-matrix');
    expect(targets[0]?.channelProviders).toEqual(['matrix']);
  });

  it('supports matrix + discord coexisting as two [[projects.platforms]] entries', () => {
    const targets = loadCcConnectProjectTargets({
      env: { AGORA_CC_CONNECT_CONFIG_PATHS: '/tmp/matrix-discord.toml' },
      exists: () => true,
      readFile: () => `
[[projects]]
name = "agora-bridge"

[projects.agent]
type = "codex"

[[projects.platforms]]
type = "discord"

[projects.platforms.options]
token = "MTQ5MTc4MTM0NDY2NDIyNzk0Mg.fake.fake"

[[projects.platforms]]
type = "matrix"
`,
    });

    expect(targets).toHaveLength(1);
    const channelProviders = targets[0]?.channelProviders ?? [];
    expect(channelProviders).toContain('discord');
    expect(channelProviders).toContain('matrix');
    // Existing Discord bot_user_ids path must still decode.
    expect(targets[0]?.discord?.bot_user_ids).toEqual(['1491781344664227942']);
  });

  it('treats matrix as just another channel provider without disturbing the existing discord shape', () => {
    const targets = loadCcConnectProjectTargets({
      env: { AGORA_CC_CONNECT_CONFIG_PATHS: '/tmp/matrix-after-discord.toml' },
      exists: () => true,
      readFile: () => `
[[projects]]
name = "agora-codex"

[projects.agent]
type = "codex"

[[projects.platforms]]
type = "discord"

[projects.platforms.options]
token = "MTQ5MTc0Nzg3Nzc5MjM4NzIwMw.fake.fake"

[[projects.platforms]]
type = "matrix"
`,
    });

    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      projectName: 'agora-codex',
      runtimeFlavor: 'codex',
      discord: { bot_user_ids: ['1491747877792387203'] },
    });
    // channelProviders must include both, sorted.
    expect(targets[0]?.channelProviders).toEqual(['discord', 'matrix']);
  });
});
