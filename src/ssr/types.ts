import type { IncomingMessage, ServerResponse } from "node:http"
import type { ResolvedConfig, ViteDevServer } from "vite"
import type { ResolvedPluginOptions } from "../options"

export type Next = () => void
export type Middleware = (req: IncomingMessage, res: ServerResponse, next: Next) => void | Promise<void>

export interface SsrStrategy {
  readonly enabled: boolean
  createDevMiddleware(
    server: ViteDevServer,
    getOptions: () => ResolvedPluginOptions,
    getConfig: () => ResolvedConfig
  ): Middleware | null
  getBuildEntry(options: ResolvedPluginOptions): string | null
  getRuntimeEntryUrl(options: ResolvedPluginOptions, serverOutDir: string): string | null
}
