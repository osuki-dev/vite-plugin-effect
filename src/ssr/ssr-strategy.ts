import * as path from "node:path"
import type { ResolvedConfig, ViteDevServer } from "vite"
import { isSsrEnabled } from "../options"
import type { ResolvedPluginOptions } from "../options"
import { createSsrMiddleware } from "./dev-renderer"
import type { SsrStrategy, Middleware } from "./types"

export type { SsrStrategy, Middleware } from "./types"

export class NoopSsrStrategy implements SsrStrategy {
  readonly enabled = false

  createDevMiddleware(): null {
    return null
  }

  getBuildEntry(): null {
    return null
  }

  getRuntimeEntryUrl(): null {
    return null
  }
}

export class ViteSsrStrategy implements SsrStrategy {
  readonly enabled = true

  createDevMiddleware(
    server: ViteDevServer,
    getOptions: () => ResolvedPluginOptions,
    getConfig: () => ResolvedConfig
  ): Middleware {
    return createSsrMiddleware(server, getOptions, getConfig, this)
  }

  getBuildEntry(options: ResolvedPluginOptions): string {
    return isSsrEnabled(options) ? (options.ssr?.entry ?? "src/entry-server.tsx") : "src/entry-server.tsx"
  }

  getRuntimeEntryUrl(options: ResolvedPluginOptions, _serverOutDir: string): string {
    const entry = this.getBuildEntry(options)
    return `new URL(${JSON.stringify("./ssr/" + path.basename(entry, path.extname(entry)) + ".js")}, import.meta.url).href`
  }
}
