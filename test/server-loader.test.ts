import { describe, test, expect } from "bun:test"
import { DevServerLoader, BuiltServerLoader } from "../src/server-loader.ts"
import type { ViteDevServer, ResolvedConfig } from "vite"
import type { ResolvedPluginOptions } from "../src/options.ts"

const mockConfig = (root: string = "/tmp") =>
  ({ root } as ResolvedConfig)

const mockOptions = (serverEntry?: string): ResolvedPluginOptions =>
  ({
    serverEntry,
    serverExports: ["MainLive"],
    serverOutDir: undefined,
  } as any)

const mockViteServer = (moduleResult: any = { handler: null }): ViteDevServer =>
  ({
    ssrLoadModule: async () => moduleResult,
    watcher: { on: () => {} },
    moduleGraph: { getModuleById: () => undefined, invalidateModule: () => {} },
    ws: { send: () => {} },
  } as any)

describe("ServerLoader", () => {
  describe("DevServerLoader", () => {
    test("returns null handler when serverEntry is undefined", async () => {
      const loader = new DevServerLoader(
        mockViteServer(),
        () => mockOptions(),
        () => mockConfig()
      )
      const api = await loader.load()
      expect(api.type).toBe("node")
      expect(api.handler).toBeNull()
    })

    test("returns legacy handler function", async () => {
      const handlerFn = () => {}
      const loader = new DevServerLoader(
        mockViteServer({ handler: handlerFn }),
        () => mockOptions("src/server.ts"),
        () => mockConfig()
      )
      const api = await loader.load()
      expect(api.type).toBe("node")
      expect(api.handler).toBe(handlerFn)
    })
  })

  describe("BuiltServerLoader", () => {
    test("returns null handler when serverEntry is undefined", async () => {
      const loader = new BuiltServerLoader(
        () => mockOptions(),
        () => mockConfig()
      )
      const api = await loader.load()
      expect(api.type).toBe("node")
      expect(api.handler).toBeNull()
    })
  })
})
