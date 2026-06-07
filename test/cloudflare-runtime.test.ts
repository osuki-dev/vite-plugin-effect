import { describe, expect, test } from "bun:test"
import { createCloudflareHandler } from "../src/cloudflare-runtime.ts"
import type { RuntimeConfig } from "../src/runtime-core.ts"

const runtimeConfig = (
  handler: (request: Request) => Promise<Response> = async (request) =>
    new Response(new URL(request.url).pathname)
): RuntimeConfig => ({
  serverModule: { handler },
  staticRoot: "",
  serverExports: ["MainLive"],
  entries: [
    { type: "http", apiPrefix: "/api", rpcPath: "/rpc" },
    { type: "rpc", apiPrefix: "/api", rpcPath: "/rpc" },
  ],
  defaultHost: "0.0.0.0",
  defaultPort: 8787,
  spaFallback: false,
})

const executionContext = () => ({
  waitUntil: () => {},
  passThroughOnException: () => {},
})

describe("cloudflare-runtime", () => {
  test("routes API requests through the Effect server module", async () => {
    const handler = createCloudflareHandler(runtimeConfig())

    const response = await handler(
      new Request("https://example.com/api/todos?limit=1"),
      {},
      executionContext()
    )

    expect(await response.text()).toBe("/todos")
  })

  test("routes RPC requests through the Effect server module", async () => {
    const handler = createCloudflareHandler(runtimeConfig())

    const response = await handler(
      new Request("https://example.com/rpc/"),
      {},
      executionContext()
    )

    expect(await response.text()).toBe("/rpc")
  })

  test("returns 404 for non-API requests", async () => {
    const handler = createCloudflareHandler(runtimeConfig())

    const response = await handler(
      new Request("https://example.com/dashboard"),
      {},
      executionContext()
    )

    expect(response.status).toBe(404)
    expect(await response.text()).toBe("Not Found")
  })
})
