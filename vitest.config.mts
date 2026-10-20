import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

// `npm test` runs the offline unit tests; `npm run smoke:sync` hits the real platform APIs.
const smoke = !!process.env.SMOKE

export default defineConfig({
  resolve: { alias: { '@shared': resolve('src/shared'), '@data': resolve('data') } },
  test: {
    include: [smoke ? 'src/**/*.smoke.ts' : 'src/**/*.test.ts'],
    testTimeout: smoke ? 120_000 : 5_000
  }
})
