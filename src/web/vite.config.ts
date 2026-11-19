import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    // The prototype reads prompts/interviewer.md from the repository root.
    fs: { allow: ['../..'] },
  },
})
