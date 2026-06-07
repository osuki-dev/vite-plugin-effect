import * as path from "node:path"
import type { ResolvedConfig, ViteDevServer } from "vite"
import { defaultBuiltServerEntryFileName } from "./defaults"
import type { ResolvedPluginOptions } from "./options"
import { resolveProjectPath } from "./path-utils"
import { loadServerApi, type LoadedApi } from "./server-api"

export interface ServerLoader {
  load(): Promise<LoadedApi>
  dispose(): Promise<void>
}

export class DevServerLoader implements ServerLoader {
  private loaded: LoadedApi | null = null
  private loadedEntry: string | null = null

  constructor(
    private readonly server: ViteDevServer,
    private readonly getOptions: () => ResolvedPluginOptions,
    private readonly getConfig: () => ResolvedConfig
  ) {}

  async load(): Promise<LoadedApi> {
    const options = this.getOptions()
    if (!options.serverEntry) {
      return { type: "node" as const, handler: null }
    }

    const serverEntryPath = resolveProjectPath(this.getConfig(), options.serverEntry)
    if (this.loaded && this.loadedEntry === serverEntryPath) {
      return this.loaded
    }

    await this.dispose()
    const serverModule = await this.server.ssrLoadModule(serverEntryPath)

    if (typeof serverModule?.handler === "function") {
      this.loaded = { type: "node" as const, handler: serverModule.handler }
      this.loadedEntry = serverEntryPath
      return this.loaded
    }

    const api = await loadServerApi(serverModule, options.serverExports)
    this.loaded = api
    this.loadedEntry = serverEntryPath
    return this.loaded
  }

  async dispose(): Promise<void> {
    if (this.loaded?.dispose) {
      await this.loaded.dispose()
    }
    this.loaded = null
    this.loadedEntry = null
  }
}

export class BuiltServerLoader implements ServerLoader {
  private loaded: LoadedApi | null = null

  constructor(
    private readonly getOptions: () => ResolvedPluginOptions,
    private readonly getConfig: () => ResolvedConfig
  ) {}

  async load(): Promise<LoadedApi> {
    const options = this.getOptions()
    if (!options.serverEntry) {
      return { type: "node" as const, handler: null }
    }

    if (this.loaded) {
      return this.loaded
    }

    const serverOutDir = path.resolve(this.getConfig().root, options.serverOutDir)

    const builtEntry = path.join(serverOutDir, defaultBuiltServerEntryFileName)
    try {
      const serverModule = await import(/* @vite-ignore */ builtEntry)
      if (typeof serverModule?.handler === "function") {
        return { type: "node" as const, handler: serverModule.handler }
      }
      const api = await loadServerApi(serverModule, options.serverExports)
      this.loaded = api
      return this.loaded
    } catch {
      return { type: "node" as const, handler: null }
    }
  }

  async dispose(): Promise<void> {
    if (this.loaded?.dispose) {
      await this.loaded.dispose()
    }
    this.loaded = null
  }
}
