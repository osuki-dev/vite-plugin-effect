// ---------------------------------------------------------------------------
// Cloudflare Workers runtime — fetch event handler for Edge deployment
// ---------------------------------------------------------------------------

import { handleRuntimeRequest, type RuntimeConfig } from "./runtime-core"

export interface CloudflareEnv {
  [key: string]: unknown
}

export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
  passThroughOnException(): void
}

export interface CloudflareHandlerOptions {
  /**
   * Enable Cloudflare's fail-open behavior for uncaught exceptions.
   *
   * @default false
   */
  readonly passThroughOnException?: boolean
}

export const createCloudflareHandler = (
  config: RuntimeConfig,
  options: CloudflareHandlerOptions = {}
) => {
  return async (
    request: Request,
    _env: CloudflareEnv,
    ctx: ExecutionContext
  ): Promise<Response> => {
    try {
      if (options.passThroughOnException === true) {
        ctx.passThroughOnException()
      }

      const url = new URL(request.url)

      // 1. Try API / RPC
      const apiResponse = await handleRuntimeRequest(config, request, url)
      if (apiResponse) return apiResponse

      return notFound()
    } catch (error) {
      return new Response(
        error instanceof Error && error.stack ? error.stack : "Effect Server Error",
        { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8" } }
      )
    }
  }
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

export default function createCloudflareDefaultExport(
  config: RuntimeConfig,
  options?: CloudflareHandlerOptions
) {
  const handler = createCloudflareHandler(config, options)
  return {
    async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext) {
      return handler(request, env, ctx)
    },
  }
}
