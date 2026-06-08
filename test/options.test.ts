import { describe, test, expect } from "bun:test"
import { resolveOptions } from "../src/options.ts"

describe("resolveOptions", () => {
  test("resolves with defaults", () => {
    const options = resolveOptions({
      serverEntry: "./src/server.ts",
    })
    expect(options.entries).toHaveLength(0)
    expect(options.clientKind).toBe("promise")
    expect(options.clientPath).toBe("src/effect-client.ts")
    expect(options.dts).toBe("src/effect-client.virtual.d.ts")
    expect(options.serverOutDir).toBe("dist/server")
    expect(options.ssr).toBe(false)
  })

  test("resolves custom virtual module id", () => {
    const options = resolveOptions({
      serverEntry: "./src/server.ts",
      virtualModuleId: "virtual:my-api",
    })
    expect(options.virtualModuleId).toBe("virtual:my-api")
    expect(options.resolvedVirtualModuleId).toBe("\0virtual:my-api")
  })

  test("resolves server exports as array", () => {
    const options = resolveOptions({
      serverEntry: "./src/server.ts",
      serverExport: ["MyLive", "AppLive"],
    })
    expect(options.serverExports).toEqual(["MyLive", "AppLive"])
  })

  test("resolves server exports as string", () => {
    const options = resolveOptions({
      serverEntry: "./src/server.ts",
      serverExport: "MyLive",
    })
    expect(options.serverExports).toEqual(["MyLive"])
  })

  test("resolves ssr options", () => {
    const options = resolveOptions({
      serverEntry: "./src/server.ts",
      ssr: { entry: "src/ssr.tsx", external: ["react"] },
    })
    expect(options.ssr).not.toBe(false)
    if (options.ssr !== false) {
      expect(options.ssr.entry).toBe("src/ssr.tsx")
      expect(options.ssr.external).toEqual(["react"])
    }
  })

  test("resolves production server options", () => {
    const options = resolveOptions({
      serverEntry: "./src/server.ts",
      productionServer: {
        host: "127.0.0.1",
        port: 8787,
        spaFallback: false,
      },
    })
    expect(options.productionServer).not.toBe(false)
    if (options.productionServer !== false) {
      expect(options.productionServer.host).toBe("127.0.0.1")
      expect(options.productionServer.port).toBe(8787)
      expect(options.productionServer.spaFallback).toBe(false)
    }
  })

  test("resolves Cloudflare production server platform", () => {
    const options = resolveOptions({
      serverEntry: "./src/server.ts",
      productionServer: {
        platform: "cloudflare",
      },
    })
    expect(options.productionServer).not.toBe(false)
    if (options.productionServer !== false) {
      expect(options.productionServer.platform).toBe("cloudflare")
    }
  })

  test("disables production server with false", () => {
    const options = resolveOptions({
      serverEntry: "./src/server.ts",
      productionServer: false,
    })
    expect(options.productionServer).toBe(false)
  })

  test("disables client generation with false", () => {
    const options = resolveOptions({
      serverEntry: "./src/server.ts",
      clientPath: false,
      dts: false,
    })
    expect(options.clientPath).toBe(false)
    expect(options.dts).toBe(false)
  })
})
