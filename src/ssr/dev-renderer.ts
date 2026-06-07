import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { ResolvedConfig, ViteDevServer } from "vite"
import type { ResolvedPluginOptions } from "../options"
import { resolveProjectPath } from "../path-utils"
import { isPluginRequest, safePathname } from "../mounts"
import type { SsrStrategy } from "./types"

export type Next = () => void

export const createSsrMiddleware = (
  server: ViteDevServer,
  getOptions: () => ResolvedPluginOptions,
  getConfig: () => ResolvedConfig,
  ssrStrategy: SsrStrategy
): ((req: IncomingMessage, res: ServerResponse, next: Next) => void | Promise<void>) => {
  return async (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next()
      return
    }

    const requestUrl = req.url || "/"
    const pathname = safePathname(requestUrl)

    // Skip API/RPC requests
    if (isPluginRequest(getOptions().entries, requestUrl)) {
      next()
      return
    }

    // Skip static asset requests and Vite internal paths
    if (
      pathname.includes(".") ||
      pathname.startsWith("/@") ||
      pathname.startsWith("/src/")
    ) {
      next()
      return
    }

    const options = getOptions()
    const ssrEntry = ssrStrategy.getBuildEntry(options)
    if (!ssrEntry) {
      next()
      return
    }
    const ssrEntryPath = resolveProjectPath(getConfig(), ssrEntry)

    try {
      // Check if SSR entry exists
      await fs.access(ssrEntryPath)
    } catch {
      next()
      return
    }

    try {
      const ssrModule = await server.ssrLoadModule("/" + ssrEntry)
      const render = ssrModule.render
      if (typeof render !== "function") {
        next()
        return
      }

      const { html } = await render()

      const template = await fs.readFile(
        path.join(getConfig().root, "index.html"),
        "utf-8"
      )
      const transformed = await server.transformIndexHtml(requestUrl, template)
      const final = transformed.replace("<!--ssr-outlet-->", html)

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      if (req.method === "HEAD") {
        res.end()
        return
      }
      res.end(final)
    } catch (error) {
      server.ssrFixStacktrace(error as Error)
      // SSR failed — fall back to serving index.html (SPA fallback)
      try {
        const template = await fs.readFile(
          path.join(getConfig().root, "index.html"),
          "utf-8"
        )
        const transformed = await server.transformIndexHtml(requestUrl, template)
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
        if (req.method === "HEAD") {
          res.end()
          return
        }
        res.end(transformed)
      } catch {
        next()
      }
    }
  }
}
