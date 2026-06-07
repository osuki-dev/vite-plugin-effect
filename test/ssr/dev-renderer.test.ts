import { describe, test, expect } from "bun:test"
import { createSsrMiddleware } from "../../src/ssr/dev-renderer.ts"
import type { ViteDevServer, ResolvedConfig } from "vite"
import type { ResolvedPluginOptions } from "../../src/options.ts"
import { ViteSsrStrategy } from "../../src/ssr/index.ts"

const mockConfig = (root: string = "/tmp") =>
  ({ root } as ResolvedConfig)

const mockOptions = (entries: any[] = [], ssr: any = {}): ResolvedPluginOptions =>
  ({
    entries,
    ssr,
    serverEntry: undefined,
    virtualModuleId: "virtual:effect/client",
  } as any)

const mockServer = (): ViteDevServer =>
  ({
    ssrLoadModule: async () => ({ render: () => ({ html: "<div>hello</div>" }) }),
    ssrFixStacktrace: () => {},
    transformIndexHtml: async (_url: string, html: string) => html,
  } as any)

describe("createSsrMiddleware", () => {
  test("returns a middleware function", () => {
    const strategy = new ViteSsrStrategy()
    const middleware = createSsrMiddleware(
      mockServer(),
      () => mockOptions(),
      () => mockConfig(),
      strategy
    )
    expect(typeof middleware).toBe("function")
  })

  test("skips non-GET requests", async () => {
    const strategy = new ViteSsrStrategy()
    const middleware = createSsrMiddleware(
      mockServer(),
      () => mockOptions(),
      () => mockConfig(),
      strategy
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    await middleware({ method: "POST", url: "/" } as any, {} as any, next)
    expect(nextCalled).toBe(true)
  })

  test("skips API requests", async () => {
    const strategy = new ViteSsrStrategy()
    const middleware = createSsrMiddleware(
      mockServer(),
      () => mockOptions([{ type: "http", apiPrefix: "/api" }]),
      () => mockConfig(),
      strategy
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    await middleware({ method: "GET", url: "/api/users" } as any, {} as any, next)
    expect(nextCalled).toBe(true)
  })

  test("skips static assets", async () => {
    const strategy = new ViteSsrStrategy()
    const middleware = createSsrMiddleware(
      mockServer(),
      () => mockOptions(),
      () => mockConfig(),
      strategy
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    await middleware({ method: "GET", url: "/assets/main.js" } as any, {} as any, next)
    expect(nextCalled).toBe(true)
  })
})
