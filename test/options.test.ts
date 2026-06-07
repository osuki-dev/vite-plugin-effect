import { describe, test, expect } from "bun:test"
import { resolveOptions } from "../src/options.ts"

describe("resolveOptions", () => {
  test("resolves with defaults", () => {
    const options = resolveOptions({
      sharedPath: "./src/shared.ts",
    })
    expect(options.entries).toHaveLength(1)
    expect(options.entries[0].type).toBe("http")
    expect(options.entries[0].sharedPath).toBe("./src/shared.ts")
    expect(options.clientKind).toBe("promise")
    expect(options.clientPath).toBe("src/effect-client.ts")
    expect(options.dts).toBe("src/effect-client.virtual.d.ts")
    expect(options.serverOutDir).toBe("dist/server")
    expect(options.ssr).toBe(false)
  })

  test("resolves http mode with custom apiPrefix", () => {
    const options = resolveOptions({
      sharedPath: "./src/shared.ts",
      mode: "http",
      apiPrefix: "/v1",
    })
    expect(options.entries[0].type).toBe("http")
    expect(options.entries[0].apiPrefix).toBe("/v1")
  })

  test("resolves rpc mode with custom rpcPath", () => {
    const options = resolveOptions({
      sharedPath: "./src/shared.ts",
      mode: "rpc",
      rpcPath: "/rpc/v1",
    })
    expect(options.entries[0].type).toBe("rpc")
    expect(options.entries[0].rpcPath).toBe("/rpc/v1")
  })

  test("resolves multiple entries", () => {
    const options = resolveOptions({
      entries: [
        { type: "http", sharedPath: "./src/api.ts" },
        { type: "rpc", sharedPath: "./src/rpc.ts" },
      ],
    })
    expect(options.entries).toHaveLength(2)
    expect(options.entries[0].type).toBe("http")
    expect(options.entries[1].type).toBe("rpc")
  })

  test("resolves custom virtual module id", () => {
    const options = resolveOptions({
      sharedPath: "./src/shared.ts",
      virtualModuleId: "virtual:my-api",
    })
    expect(options.virtualModuleId).toBe("virtual:my-api")
    expect(options.resolvedVirtualModuleId).toBe("\0virtual:my-api")
  })

  test("resolves server exports as array", () => {
    const options = resolveOptions({
      sharedPath: "./src/shared.ts",
      serverExport: ["MyLive", "AppLive"],
    })
    expect(options.serverExports).toEqual(["MyLive", "AppLive"])
  })

  test("resolves server exports as string", () => {
    const options = resolveOptions({
      sharedPath: "./src/shared.ts",
      serverExport: "MyLive",
    })
    expect(options.serverExports).toEqual(["MyLive"])
  })

  test("resolves ssr options", () => {
    const options = resolveOptions({
      sharedPath: "./src/shared.ts",
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
      sharedPath: "./src/shared.ts",
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
      sharedPath: "./src/shared.ts",
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
      sharedPath: "./src/shared.ts",
      productionServer: false,
    })
    expect(options.productionServer).toBe(false)
  })

  test("disables client generation with false", () => {
    const options = resolveOptions({
      sharedPath: "./src/shared.ts",
      clientPath: false,
      dts: false,
    })
    expect(options.clientPath).toBe(false)
    expect(options.dts).toBe(false)
  })
})
