import { describe, test, expect } from "bun:test"
import {
  generateVirtualClientModule,
  generateVirtualTypesModule,
  generateVirtualClientDts,
} from "../src/client-generator/index.ts"
import type { ResolvedPluginOptions } from "../src/options.ts"
import type { ResolvedConfig } from "vite"

const mockConfig = (root: string = "/tmp") =>
  ({ root } as ResolvedConfig)

const mockOptions = (overrides: Partial<ResolvedPluginOptions> = {}): ResolvedPluginOptions =>
  ({
    entries: [],
    clientPath: "src/effect-client.ts",
    dts: "src/effect-client.d.ts",
    virtualModuleId: "virtual:effect/client",
    resolvedVirtualModuleId: "\0virtual:effect/client",
    virtualTypesModuleId: "virtual:effect/client-types",
    resolvedVirtualTypesModuleId: "\0virtual:effect/client-types",
    clientKind: "promise",
    ...overrides,
  } as any)

describe("client-generator", () => {
  describe("generateVirtualClientModule", () => {
    test("throws when clientPath is false", () => {
      const options = mockOptions({ clientPath: false })
      expect(() => generateVirtualClientModule(options, mockConfig())).toThrow("clientPath: false requires virtualModuleContent")
    })

    test("returns default re-export for clientPath", () => {
      const options = mockOptions({ clientPath: "src/effect-client.ts" })
      const code = generateVirtualClientModule(options, mockConfig("/project"))
      expect(code).toContain("export { client, effectClient, promiseClient }")
      expect(code).toContain("/project/src/effect-client.ts")
    })
  })

  describe("generateVirtualTypesModule", () => {
    test("returns virtual client types", () => {
      const code = generateVirtualTypesModule()
      expect(code).toContain("AwaitableClient")
      expect(code).toContain("effectClient: never")
      expect(code).toContain("promiseClient: never")
      expect(code).toContain("client: never")
    })
  })

  describe("generateVirtualClientDts", () => {
    test("points the virtual module at the generated reflection client", () => {
      const options = mockOptions({ clientPath: "src/effect-client.ts" })
      const code = generateVirtualClientDts(options, mockConfig("/project"), "/project/src/effect-client.virtual.d.ts")
      expect(code).toContain('declare module "virtual:effect/client"')
      expect(code).toContain('export { client, effectClient, promiseClient } from "./effect-client"')
      expect(code).toContain('export type * from "./effect-client"')
      expect(code).toContain('readonly client: import("./effect-client").EffectClient')
      expect(code).toContain('readonly defaultClient: import("./effect-client").Client')
    })

    test("uses unknown when no generated client file exists", () => {
      const options = mockOptions({ clientPath: false })
      const code = generateVirtualClientDts(options, mockConfig("/project"))
      expect(code).toContain("readonly client: never")
      expect(code).toContain("readonly defaultClient: never")
      expect(code).not.toContain("HttpApiClient.ForApi")
      expect(code).not.toContain("RpcClient.FromGroup")
    })
  })
})
