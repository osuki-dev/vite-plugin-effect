import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import vitePluginEffect from '../../dist/index.js'
import pkg from '../../package.json' with { type: 'json' }

const isCloudflareBuild = process.env.VITE_PLUGIN_EFFECT_PLATFORM === 'cloudflare'

// https://vite.dev/config/
export default defineConfig({
  define: {
    __PLUGIN_NAME__: JSON.stringify(pkg.name),
    __PLUGIN_VERSION__: JSON.stringify(pkg.version),
  },
  appType: 'custom',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react(),
    vitePluginEffect({
      clientKind: "promise",
      serverEntry: "./src/server/handler.ts",
      clientPath: "src/lib/effect-client.ts",
      dts: "src/lib/effect-client.virtual.d.ts",
      ssr: {
        entry: "src/entry-server.tsx",
        external: [
          "react",
          "react-dom",
          "react-dom/server",
          "react-dom/client",
        ],
      },
      productionServer: isCloudflareBuild
        ? { platform: "cloudflare" }
        : undefined,
    }),
  ],
})
