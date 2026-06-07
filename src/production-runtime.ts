/**
 * Production runtime — Node.js fullstack server that loads the built Effect
 * server layer, handles API/RPC mounts, serves static assets, and supports SSR.
 *
 * This module is compiled to dist/server/production-runtime.js during build.
 * The generated index.js imports it and injects configuration.
 */

import { createServer } from "node:http"
import { handleRuntimeRequest, matchRuntimeEntry, disposeApi, type RuntimeConfig } from "./runtime-core"
import { nodeRequestToWebRequest } from "./server-runtime"
import { NodeStaticFileServer, formatAddress } from "./static-file-server"
import { NodeSsrRenderer } from "./ssr/prod-renderer"

export const startProductionServer = async (
  config: RuntimeConfig
): Promise<void> => {
  const staticFileServer = new NodeStaticFileServer()
  const ssrRenderer = new NodeSsrRenderer()

  const server = createServer(async (req, res) => {
    try {
      const requestUrl = req.url || "/"
      const url = new URL(requestUrl, "http://localhost")

      // 1. Try API / RPC
      if (matchRuntimeEntry(config.entries, url.pathname)) {
        const webRequest = await nodeRequestToWebRequest(req, () => {})
        const apiResponse = await handleRuntimeRequest(config, webRequest, url)
        if (apiResponse) {
          res.writeHead(apiResponse.status, Object.fromEntries(apiResponse.headers.entries()))
          if (apiResponse.body) {
            const body = Buffer.from(await apiResponse.arrayBuffer())
            res.end(body)
          } else {
            res.end()
          }
          return
        }
      }

      // 2. Try SSR
      if (config.ssrEntryUrl) {
        const rendered = await ssrRenderer.render(req, res, config.ssrEntryUrl, config.staticRoot)
        if (rendered) return
      }

      // 3. Static files
      await staticFileServer.serve(req, res, config.staticRoot, config.spaFallback)
    } catch (error) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" })
      res.end(error instanceof Error && error.stack ? error.stack : "Effect Server Error")
    }
  })

  const host = process.env.HOST || config.defaultHost
  const port = Number.parseInt(process.env.PORT || String(config.defaultPort), 10)
  server.listen(Number.isFinite(port) ? port : config.defaultPort, host, () => {
    console.log("[vite-plugin-effect] Fullstack server listening on " + formatAddress(server.address()))
  })

  const shutdown = async () => {
    await new Promise((resolve) => server.close(resolve))
    await disposeApi()
  }

  process.once("SIGINT", () => {
    shutdown().finally(() => process.exit(0))
  })
  process.once("SIGTERM", () => {
    shutdown().finally(() => process.exit(0))
  })
}
