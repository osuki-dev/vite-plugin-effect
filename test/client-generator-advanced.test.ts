import { describe, test, expect } from "bun:test"
import { generateClientOutputs } from "../src/client-generator/index.ts"
import type { ResolvedPluginOptions, ResolvedClientEntry } from "../src/options.ts"
import type { ResolvedConfig } from "vite"

const mockConfig = (root: string = "/tmp"): ResolvedConfig =>
  ({ root, command: "serve", build: { outDir: "dist" } } as any)

const mockOptions = (overrides: Partial<ResolvedPluginOptions> = {}): ResolvedPluginOptions =>
  ({
    entries: [],
    clientPath: "src/effect-client.ts",
    dts: "src/effect-client.d.ts",
    virtualModuleId: "virtual:effect/client",
    resolvedVirtualModuleId: "\0virtual:effect/client",
    virtualTypesModuleId: "virtual:effect/client?types",
    resolvedVirtualTypesModuleId: "\0virtual:effect/client?types",
    clientKind: "promise",
    ...overrides,
  } as any)

describe("generateClientOutputs advanced", () => {
  test("generates schema type aliases when schemas are exported", async () => {
    const root = await Bun.file("/tmp").text().catch(() => "")
    const config = mockConfig("/tmp")
    const options = mockOptions({
      entries: [{
        type: "http",
        name: "api",
        sharedPath: "./src/shared.ts",
        exportName: "MyApi",
        apiPrefix: "/api",
        rpcPath: "",
      } as ResolvedClientEntry],
    })
    const outputs = await generateClientOutputs(options, config)
    expect(outputs.clientCode).toContain("export type EffectClient")
    expect(outputs.clientCode).toContain("export type PromiseClient")
    expect(outputs.clientCode).toContain("export type Client")
  })

  test("generates combined type for multiple entries", async () => {
    const config = mockConfig("/tmp")
    const options = mockOptions({
      entries: [
        { type: "http", name: "api", sharedPath: "./src/api.ts", exportName: "Api", apiPrefix: "/api", rpcPath: "" } as ResolvedClientEntry,
        { type: "rpc", name: "rpc", sharedPath: "./src/rpc.ts", exportName: "Rpc", apiPrefix: "", rpcPath: "/rpc" } as ResolvedClientEntry,
      ],
    })
    const outputs = await generateClientOutputs(options, config)
    expect(outputs.clientCode).toContain("api: Entry0EffectClient")
    expect(outputs.clientCode).toContain("rpc: Entry1EffectClient")
    expect(outputs.clientCode).toContain("export type EffectClient = { readonly api: Entry0EffectClient; readonly rpc: Entry1EffectClient }")
  })

  test("generates dts for inline client (no clientPath)", async () => {
    const config = mockConfig("/tmp")
    const options = mockOptions({
      clientPath: false,
      entries: [{
        type: "http",
        name: "api",
        sharedPath: "./src/shared.ts",
        exportName: "MyApi",
        apiPrefix: "/api",
        rpcPath: "",
      } as ResolvedClientEntry],
    })
    const outputs = await generateClientOutputs(options, config)
    expect(outputs.dtsCode).toContain("declare module")
    expect(outputs.dtsCode).toContain("EffectClientConfig")
    expect(outputs.dtsCode).toContain("MyApi")
  })

  test("generates dts for effect client kind", async () => {
    const config = mockConfig("/tmp")
    const options = mockOptions({
      clientKind: "effect",
      clientPath: false,
      entries: [{
        type: "http",
        name: "api",
        sharedPath: "./src/shared.ts",
        exportName: "MyApi",
        apiPrefix: "/api",
        rpcPath: "",
      } as ResolvedClientEntry],
    })
    const outputs = await generateClientOutputs(options, config)
    expect(outputs.dtsCode).toContain("HttpApiClient.ForApi")
    expect(outputs.dtsCode).not.toContain("AwaitableClient")
  })

  test("generates dts for promise client kind", async () => {
    const config = mockConfig("/tmp")
    const options = mockOptions({
      clientKind: "promise",
      clientPath: false,
      entries: [{
        type: "http",
        name: "api",
        sharedPath: "./src/shared.ts",
        exportName: "MyApi",
        apiPrefix: "/api",
        rpcPath: "",
      } as ResolvedClientEntry],
    })
    const outputs = await generateClientOutputs(options, config)
    expect(outputs.dtsCode).toContain("AwaitableClient")
  })
})
