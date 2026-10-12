import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const projectRoot = fileURLToPath(new URL('../..', import.meta.url))
const frontendNodeModules = fileURLToPath(new URL('./node_modules/', import.meta.url))
const frontendTestSetup = fileURLToPath(new URL('../../tests/frontend/test-setup.js', import.meta.url))

export default defineConfig({
  root: projectRoot,
  plugins: [react()],
  resolve: {
    alias: {
      react: `${frontendNodeModules}/react`,
      'react-dom': `${frontendNodeModules}/react-dom`,
      '@testing-library/react': `${frontendNodeModules}/@testing-library/react`,
      '@testing-library/jest-dom/vitest': `${frontendNodeModules}/@testing-library/jest-dom/vitest.js`,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: frontendTestSetup,
    include: ['tests/frontend/**/*.{test,spec}.{js,jsx}'],
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
  },
})
