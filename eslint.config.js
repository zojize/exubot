// @ts-check
import antfu from '@antfu/eslint-config'
import nuxt from './.nuxt/eslint.config.mjs'

export default antfu(
  {
    ignores: ['deps/**', 'data/**'],
    test: {
      overrides: { 'test/no-import-node-test': 'off' },
    },
    unocss: true,
    formatters: true,
    pnpm: true,
  },
)
  .append(nuxt(), {
    files: ['pnpm-workspace.yaml'],
    rules: { 'pnpm/yaml-enforce-settings': 'off' },
  })
