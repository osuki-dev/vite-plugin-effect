import { describe, test, expect } from "bun:test"
import { generateProductionServerRuntime } from "../src/production-server.ts"
import type { ResolvedPluginOptions } from "../src/options.ts"
import { NoopSsrStrategy, ViteSsrStrategy } from "../src/ssr/index.ts"

describe("generateProductionServerRuntime", () => {
  test("generates runtime with SSR disabled", () => {
    const code = generateProductionServerRuntime({
      runtimeEntryPath: "/project/dist/server/index.js",
      builtServerEntryPath: "/project/dist/server/server-entry.js",
      staticRootPath: "/project/dist",
      serverOutDir: "/project/dist/server",
      options: {
        entries: [{ type: "http", apiPrefix: "/api", rpcPath: "" }],
        serverExports: ["MainLive"],
        productionServer: {
          host: "127.0.0.1",
          port: 8787,
          spaFallback: false,
        },
      } as ResolvedPluginOptions,
      ssrStrategy: new NoopSsrStrategy(),
    })
    expect(code).toContain("startProductionServer")
    expect(code).toContain("serverEntryUrl")
    expect(code).toContain("staticRoot")
    expect(code).not.toContain("ssrEntryUrl")
    expect(code).toContain('defaultHost: "127.0.0.1"')
    expect(code).toContain("defaultPort: 8787")
    expect(code).toContain("spaFallback: false")
  })

  test("generates runtime with SSR enabled", () => {
    const code = generateProductionServerRuntime({
      runtimeEntryPath: "/project/dist/server/index.js",
      builtServerEntryPath: "/project/dist/server/server-entry.js",
      staticRootPath: "/project/dist",
      serverOutDir: "/project/dist/server",
      options: {
        entries: [{ type: "http", apiPrefix: "/api", rpcPath: "" }],
        serverExports: ["MainLive"],
        productionServer: {
          host: "0.0.0.0",
          port: 3000,
          spaFallback: true,
        },
      } as ResolvedPluginOptions,
      ssrStrategy: new ViteSsrStrategy(),
    })
    expect(code).toContain("startProductionServer")
    expect(code).toContain("ssrEntryUrl")
    expect(code).toContain('defaultHost: "0.0.0.0"')
    expect(code).toContain("defaultPort: 3000")
    expect(code).toContain("spaFallback: true")
  })

  test("generates Cloudflare Worker runtime with static server import", () => {
    const code = generateProductionServerRuntime({
      runtimeEntryPath: "/project/dist/server/index.js",
      builtServerEntryPath: "/project/dist/server/server-entry.js",
      staticRootPath: "/project/dist",
      serverOutDir: "/project/dist/server",
      options: {
        entries: [{ type: "http", apiPrefix: "/api", rpcPath: "" }],
        serverExports: ["MainLive"],
        productionServer: {
          platform: "cloudflare",
          host: "0.0.0.0",
          port: 8787,
          spaFallback: false,
        },
      } as ResolvedPluginOptions,
      ssrStrategy: new NoopSsrStrategy(),
    })

    expect(code).toContain('import { createCloudflareHandler } from "./cloudflare-runtime.js"')
    expect(code).toContain('import * as serverModule from "./server-entry.js"')
    expect(code).toContain("serverModule")
    expect(code).toContain('platform: "cloudflare"')
    expect(code).not.toContain("serverEntryUrl")
    expect(code).not.toContain("request: Request")
    expect(code).not.toContain("ctx: ExecutionContext")
  })

  test("throws when productionServer is false", () => {
    expect(() => generateProductionServerRuntime({
      runtimeEntryPath: "/project/dist/server/index.js",
      builtServerEntryPath: "/project/dist/server/server-entry.js",
      staticRootPath: "/project/dist",
      serverOutDir: "/project/dist/server",
      options: {
        productionServer: false,
      } as ResolvedPluginOptions,
      ssrStrategy: new NoopSsrStrategy(),
    })).toThrow("productionServer options are required")
  })
})
