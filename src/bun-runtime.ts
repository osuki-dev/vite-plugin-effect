/**
 * Bun runtime — uses Bun.serve() for optimal performance on Bun.
 *
 * This module is compiled to dist/server/bun-runtime.js during build.
 * The generated index.js imports it and injects configuration.
 */

import { handleRuntimeRequest, matchRuntimeEntry, disposeApi, type RuntimeConfig } from "./runtime-core"

export const startBunServer = async (
  config: RuntimeConfig
): Promise<void> => {
  const host = process.env.HOST || config.defaultHost
  const port = Number.parseInt(process.env.PORT || String(config.defaultPort), 10)

  const server = Bun.serve({
    port: Number.isFinite(port) ? port : config.defaultPort,
    hostname: host,
    async fetch(request) {
      try {
        const url = new URL(request.url)

        // 1. Try API / RPC
        if (matchRuntimeEntry(config.entries, url.pathname)) {
          const apiResponse = await handleRuntimeRequest(config, request, url)
          if (apiResponse) {
            return apiResponse
          }
        }

        // 2. Static files (Bun serves static files natively)
        // For now, fall through to 404 — static files should be handled by a reverse proxy
        // or Bun's built-in static file serving in production
        return new Response("Not Found", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        })
      } catch (error) {
        return new Response(
          error instanceof Error && error.stack ? error.stack : "Effect Server Error",
          { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        )
      }
    },
  })

  console.log(`[vite-plugin-effect] Fullstack Bun server listening on http://${host}:${server.port}`)

  const shutdown = async () => {
    server.stop()
    await disposeApi()
  }

  process.once("SIGINT", () => {
    shutdown().finally(() => process.exit(0))
  })
  process.once("SIGTERM", () => {
    shutdown().finally(() => process.exit(0))
  })
}
