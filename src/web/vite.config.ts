import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node' },
  server: {
    port: 5173,
    strictPort: true,
    // The prototype reads prompts/interviewer.md from the repository root.
    fs: { allow: ['../..'] },
  },
})
