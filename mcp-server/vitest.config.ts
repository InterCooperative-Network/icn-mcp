import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: { 
    environment: 'node' 
  },
  resolve: { 
    alias: { 
      '@': resolve(__dirname, 'src'),
      '@mcp-node/tools/icn_workflow': resolve(__dirname, '../mcp-node/src/tools/icn_workflow')
    } 
  },
})