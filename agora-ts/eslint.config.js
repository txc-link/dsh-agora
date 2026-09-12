import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts', '**/*.tsbuildinfo', 'vitest.config.ts', 'eslint.config.js', 'scripts/**/*.ts'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // FR-071 reviewer artifact: an independent, byte-frozen adversarial suite
    // (sha256 d7776d3a...). It ships one unused import and by contract must not
    // be edited, so it is exempted from lint only — every rule below still
    // applies to the rest of the repository.
    ignores: ['**/radicale-calendar.fr071-adversarial.test.ts'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
