import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolveDataSource } from './src/build/dataSource.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // Unit tests always run against the demo data; every build and dev server must say which.
  const dataSource = resolveDataSource(mode === 'test' ? (env.VITE_DATA_SOURCE ?? 'demo') : env.VITE_DATA_SOURCE)

  return {
    plugins: [react()],
    define: { __DEMO__: JSON.stringify(dataSource === 'demo') },
    test: { environment: 'node' },
    server: {
      port: 5173,
      strictPort: true,
      // The prototype reads prompts/interviewer.md from the repository root.
      fs: { allow: ['../..'] },
      // The browser calls the API at /api on its own origin. Point this at the API
      // (the port in its launchSettings.json) or set API_PROXY_TARGET.
      proxy: { '/api': { target: process.env.API_PROXY_TARGET ?? 'http://localhost:5270' } },
    },
  }
})
