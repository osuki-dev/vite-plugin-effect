import * as path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { ResolvedConfig, ViteDevServer } from "vite"
import type { ResolvedPluginOptions } from "./options"
import { resolveProjectPath } from "./path-utils"
import { DevServerLoader, BuiltServerLoader } from "./server-loader"
import { ApiRequestRouter } from "./api-request-router"

type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void | Promise<void>

export const createApiMiddleware = (
  loader: DevServerLoader | BuiltServerLoader,
  getOptions: () => ResolvedPluginOptions,
  getConfig: () => ResolvedConfig,
  errorHandler?: (error: Error) => void
): Middleware => {
  const router = new ApiRequestRouter(loader, getOptions, getConfig, errorHandler)
  return (req, res, next) => router.route(req, res, next)
}

export const createDevApiMiddleware = (
  server: ViteDevServer,
  getOptions: () => ResolvedPluginOptions,
  getConfig: () => ResolvedConfig,
  hooks: {
    readonly onEntriesStale?: () => Promise<void>
  } = {}
): Middleware => {
  const loader = new DevServerLoader(server, getOptions, getConfig)
  const middleware = createApiMiddleware(
    loader,
    getOptions,
    getConfig,
    (error) => server.ssrFixStacktrace(error)
  )

  server.watcher?.on("change", async (file) => {
    const options = getOptions()
    const normalized = file.replace(/\\/g, "/")
    const serverEntry = options.serverEntry
      ? resolveProjectPath(getConfig(), options.serverEntry)
      : null
    const sharedPaths = options.entries.map((entry) => resolveProjectPath(getConfig(), entry.sharedPath))
    if (normalized === serverEntry || sharedPaths.includes(normalized)) {
      await loader.dispose()
      await hooks.onEntriesStale?.()
      const virtualModule = server.moduleGraph.getModuleById(options.resolvedVirtualModuleId)
      if (virtualModule) {
        server.moduleGraph.invalidateModule(virtualModule)
        server.ws.send({ type: "full-reload" })
      }
    }
  })

  return middleware
}

export const createPreviewApiMiddleware = (
  getOptions: () => ResolvedPluginOptions,
  getConfig: () => ResolvedConfig
): Middleware => {
  const loader = new BuiltServerLoader(getOptions, getConfig)
  return createApiMiddleware(loader, getOptions, getConfig)
}
