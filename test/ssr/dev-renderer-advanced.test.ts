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

const mockServer = (overrides: Partial<ViteDevServer> = {}): ViteDevServer =>
  ({
    ssrLoadModule: async () => ({ render: () => ({ html: "<div>hello</div>" }) }),
    ssrFixStacktrace: () => {},
    transformIndexHtml: async (_url: string, html: string) => html,
    watcher: { on: () => {} },
    moduleGraph: { getModuleById: () => undefined, invalidateModule: () => {} },
    ws: { send: () => {} },
    ...overrides,
  } as any)

describe("createSsrMiddleware advanced", () => {
  test("skips HEAD requests that are not HTML", async () => {
    const strategy = new ViteSsrStrategy()
    const middleware = createSsrMiddleware(
      mockServer(),
      () => mockOptions(),
      () => mockConfig(),
      strategy
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    await middleware({ method: "HEAD", url: "/" } as any, {} as any, next)
    expect(nextCalled).toBe(true)
  })

  test("skips Vite internal paths", async () => {
    const strategy = new ViteSsrStrategy()
    const middleware = createSsrMiddleware(
      mockServer(),
      () => mockOptions(),
      () => mockConfig(),
      strategy
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    await middleware({ method: "GET", url: "/@vite/client" } as any, {} as any, next)
    expect(nextCalled).toBe(true)
  })

  test("skips src paths", async () => {
    const strategy = new ViteSsrStrategy()
    const middleware = createSsrMiddleware(
      mockServer(),
      () => mockOptions(),
      () => mockConfig(),
      strategy
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    await middleware({ method: "GET", url: "/src/main.tsx" } as any, {} as any, next)
    expect(nextCalled).toBe(true)
  })

  test("skips when SSR entry does not exist", async () => {
    const strategy = new ViteSsrStrategy()
    const middleware = createSsrMiddleware(
      mockServer(),
      () => mockOptions([], { entry: "src/nonexistent.tsx" }),
      () => mockConfig(),
      strategy
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    await middleware({ method: "GET", url: "/" } as any, {} as any, next)
    expect(nextCalled).toBe(true)
  })

  test("skips when SSR module has no render function", async () => {
    const strategy = new ViteSsrStrategy()
    const middleware = createSsrMiddleware(
      mockServer({
        ssrLoadModule: async () => ({ noRender: true }),
      }),
      () => mockOptions([], {}),
      () => mockConfig(),
      strategy
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    await middleware({ method: "GET", url: "/" } as any, {} as any, next)
    expect(nextCalled).toBe(true)
  })
})
