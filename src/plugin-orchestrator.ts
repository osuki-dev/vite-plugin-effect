import * as path from "node:path"
import type { Plugin, ResolvedConfig, UserConfig } from "vite"
import { defaultBuiltServerEntryFileName } from "./defaults"
import { discoverEntriesFromServerEntry } from "./discovery"
import {
  generateVirtualClientModule,
  generateVirtualTypesModule,
  writeClientOutputs,
} from "./client-generator"
import { resolveOptions, isSsrEnabled, type VitePluginEffectOptions, type ResolvedPluginOptions } from "./options"
import { resolveProjectPath } from "./path-utils"
import { createDevApiMiddleware, createPreviewApiMiddleware } from "./api-middleware"
import { NoopSsrStrategy, ViteSsrStrategy, type SsrStrategy } from "./ssr/index"
import { runBuildPipeline } from "./build-pipeline"

export class PluginOrchestrator {
  private resolvedConfig: ResolvedConfig | undefined
  private readonly hasExplicitEntries: boolean

  constructor(
    private resolvedOptions: ResolvedPluginOptions,
    private readonly ssrStrategy: SsrStrategy,
  ) {
    this.hasExplicitEntries = resolvedOptions.entries.length > 0
  }

  getOptions(): ResolvedPluginOptions {
    return this.resolvedOptions
  }

  getConfig(): ResolvedConfig {
    if (!this.resolvedConfig) {
      throw new Error("vite-plugin-effect config is not resolved yet")
    }
    return this.resolvedConfig
  }

  private async refreshEntries(config: ResolvedConfig) {
    if (this.hasExplicitEntries) return
    const entries = await discoverEntriesFromServerEntry(this.resolvedOptions, config)
    this.resolvedOptions = { ...this.resolvedOptions, entries }
  }

  private async regenerateClient(config: ResolvedConfig) {
    await this.refreshEntries(config)
    this.assertBrowserSafeEntries(config)
    await writeClientOutputs(this.resolvedOptions, config)
  }

  // -------------------------------------------------------------------------
  // Vite lifecycle hooks
  // -------------------------------------------------------------------------

  resolveViteConfig(config: UserConfig, env?: { command: string }) {
    if (env?.command !== "build") return undefined

    const serverEntry = this.resolvedOptions.serverBuildEntry ?? this.resolvedOptions.serverEntry
    if (!serverEntry) return undefined

    const root = config.root ?? process.cwd()
    const serverOutDir = path.resolve(root, this.resolvedOptions.serverOutDir)

    return {
      builder: {
        buildApp: async (builder: any) => {
          const environments = Object.values(builder.environments)
          await Promise.all(
            environments.map((environment) => builder.build(environment))
          )
        },
      },
      environments: {
        client: {
          build: {
            emptyOutDir: false,
          },
        },
        server: {
          build: {
            ssr: true,
            emptyOutDir: false,
            outDir: serverOutDir,
            rollupOptions: {
              input: path.resolve(root, serverEntry),
              output: {
                entryFileNames: defaultBuiltServerEntryFileName,
                chunkFileNames: "chunks/[name]-[hash].js",
              },
              external: [
                "effect",
                /^effect\//,
                /^node:/,
              ],
            },
          },
        },
      },
    }
  }

  async onConfigResolved(config: ResolvedConfig) {
    this.resolvedConfig = config
    await this.regenerateClient(config)
  }

  resolveVirtualModuleId(id: string): string | undefined {
    if (id === this.resolvedOptions.virtualModuleId) {
      return this.resolvedOptions.resolvedVirtualModuleId
    }
    if (id === this.resolvedOptions.virtualTypesModuleId) {
      return this.resolvedOptions.resolvedVirtualTypesModuleId
    }
    if (id.startsWith(`${this.resolvedOptions.virtualModuleId}/`)) {
      return `\0${id}`
    }
    return undefined
  }

  loadVirtualModule(id: string): string | undefined {
    if (id === this.resolvedOptions.resolvedVirtualModuleId) {
      return generateVirtualClientModule(this.resolvedOptions, this.getConfig())
    }
    if (id === this.resolvedOptions.resolvedVirtualTypesModuleId) {
      return generateVirtualTypesModule()
    }
    return undefined
  }

  async onBuildStart() {
    await this.regenerateClient(this.getConfig())
  }

  async onCloseBundle() {
    // Server build is handled by buildApp hook — no-op here
  }

  async onBuildApp(builder: any) {
    const config = this.getConfig()
    if (config.command !== "build") return

    const serverEntry = this.resolvedOptions.serverBuildEntry ?? this.resolvedOptions.serverEntry
    if (!serverEntry) return

    const serverEnv = builder.environments.server
    if (!serverEnv?.isBuilt) return

    await this.buildServer(config, builder)
  }

  private async buildServer(config: ResolvedConfig, builder?: any) {
    const serverEntry = this.resolvedOptions.serverBuildEntry ?? this.resolvedOptions.serverEntry
    if (!serverEntry) return

    const serverOutDir = path.resolve(config.root, this.resolvedOptions.serverOutDir)

    console.log(`[vite-plugin-effect] Building server to ${serverOutDir}`)

    try {
      await runBuildPipeline(config, this.resolvedOptions, serverOutDir, builder, this.ssrStrategy)
      console.log("[vite-plugin-effect] Server build complete")
    } catch (error) {
      console.error("[vite-plugin-effect] Server build failed:", error)
      throw error
    }
  }

  // -------------------------------------------------------------------------
  // Plugin facade
  // -------------------------------------------------------------------------

  toPlugin(): Plugin {
    const resolvedOptions = this.resolvedOptions

    return {
      name: "vite-plugin-effect",

      config: (config, env) => {
        return this.resolveViteConfig(config, env)
      },

      configResolved: async (config) => {
        await this.onConfigResolved(config)
      },

      resolveId: (id) => {
        return this.resolveVirtualModuleId(id)
      },

      load: (id) => {
        return this.loadVirtualModule(id)
      },

      configureServer: (server) => {
        const middleware = createDevApiMiddleware(
          server,
          () => this.getOptions(),
          () => this.getConfig(),
          {
            onEntriesStale: async () => {
              await this.onBuildStart()
            },
          }
        )
        server.middlewares.use(middleware)

        const ssrMiddleware = this.ssrStrategy.createDevMiddleware(
          server,
          () => this.getOptions(),
          () => this.getConfig()
        )
        if (ssrMiddleware) {
          server.middlewares.use(ssrMiddleware)
        }
      },

      configurePreviewServer: (server) => {
        const middleware = createPreviewApiMiddleware(
          () => this.getOptions(),
          () => this.getConfig()
        )
        server.middlewares.use(middleware)
      },

      buildStart: async () => {
        await this.onBuildStart()
      },

      closeBundle: async () => {
        await this.onCloseBundle()
      },

      buildApp: {
        order: "post",
        handler: async (builder) => {
          await this.onBuildApp(builder)
        },
      },
    }
  }

  // -------------------------------------------------------------------------
  // Safety check
  // -------------------------------------------------------------------------

  private assertBrowserSafeEntries(config: ResolvedConfig) {
    const serverOnlyEntries = [
      this.resolvedOptions.serverEntry,
      this.resolvedOptions.serverBuildEntry,
    ]
      .filter((entry): entry is string => entry !== undefined)
      .map((entry) => resolveProjectPath(config, entry))

    if (serverOnlyEntries.length === 0) return

    for (const entry of this.resolvedOptions.entries) {
      const sharedPath = resolveProjectPath(config, entry.sharedPath)
      if (serverOnlyEntries.includes(sharedPath)) {
        throw new Error(
          `vite-plugin-effect: entries[].sharedPath must point to a browser-safe Effect contract module, not the server entry (${entry.sharedPath}). Move HttpApi/RpcGroup declarations to a shared contract file and keep MainLive/ServerLive in serverEntry.`
        )
      }
    }
  }
}

export function createPlugin(options: VitePluginEffectOptions): Plugin {
  const resolvedOptions = resolveOptions(options)
  const ssrStrategy = isSsrEnabled(resolvedOptions) ? new ViteSsrStrategy() : new NoopSsrStrategy()
  const orchestrator = new PluginOrchestrator(resolvedOptions, ssrStrategy)
  return orchestrator.toPlugin()
}
