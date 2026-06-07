import * as path from "node:path"
import type { Plugin, ResolvedConfig } from "vite"
import { isSsrEnabled } from "../options"
import type { ResolvedPluginOptions } from "../options"
import { resolveProjectPath } from "../path-utils"
import type { SsrStrategy } from "./types"

function createVirtualModuleShimPlugin(options: ResolvedPluginOptions, config: ResolvedConfig): Plugin {
  const clientPath = options.clientPath
    ? resolveProjectPath(config, options.clientPath)
    : undefined
  const virtualModuleId = options.virtualModuleId
  return {
    name: "vite-plugin-effect-ssr-shim",
    enforce: "pre",
    resolveId(id: string) {
      if (id === virtualModuleId) {
        return clientPath
      }
      if (id === `${virtualModuleId}?types`) {
        return clientPath
      }
      if (id.startsWith(`${virtualModuleId}/`)) {
        return clientPath
      }
    },
  } as Plugin
}

function createCssStubPlugin(): Plugin {
  return {
    name: "vite-plugin-effect-ssr-css-stub",
    enforce: "pre",
    load(id: string) {
      if (id.endsWith(".css")) {
        return ""
      }
    },
  } as Plugin
}

export async function buildSsrBundle(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
  serverOutDir: string,
  ssrStrategy: SsrStrategy,
): Promise<void> {
  const ssrEntry = ssrStrategy.getBuildEntry(options)
  if (!ssrEntry) return

  const ssrOutDir = path.join(serverOutDir, "ssr")
  console.log(`[vite-plugin-effect] Building SSR bundle to ${ssrOutDir}`)

  const ssrExternal = isSsrEnabled(options)
    ? ["effect", /^effect\//, /^node:/, ...options.ssr.external]
    : ["effect", /^effect\//, /^node:/]

  const vite = await import("vite")
  await vite.build({
    root: config.root,
    configFile: false,
    plugins: [
      createVirtualModuleShimPlugin(options, config),
      createCssStubPlugin(),
    ],
    build: {
      ssr: true,
      emptyOutDir: false,
      outDir: ssrOutDir,
      rollupOptions: {
        input: ssrEntry,
        output: {
          entryFileNames: "entry-server.js",
          chunkFileNames: "chunks/[name]-[hash].js",
        },
        external: ssrExternal,
      },
    },
  })
  console.log("[vite-plugin-effect] SSR bundle build complete")
}
