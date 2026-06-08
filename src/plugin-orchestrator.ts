import * as path from "node:path"
import { readFileSync, statSync } from "node:fs"
import { pathToFileURL } from "node:url"
import type * as Schema from "effect/Schema"
import type { ConfigEnv, Plugin, ResolvedConfig, UserConfig, ViteBuilder } from "vite"
import { defaultBuiltServerEntryFileName } from "./defaults"
import { discoverEntriesFromServerEntry } from "./discovery"
import {
  generateVirtualClientModule,
  generateVirtualTypesModule,
  generateVirtualClientDts,
} from "./client-generator"
import { resolveOptions, isSsrEnabled, isDtsEnabled, type VitePluginEffectOptions, type ResolvedPluginOptions } from "./options"
import { resolveProjectPath } from "./path-utils"
import { createDevApiMiddleware, createPreviewApiMiddleware } from "./api-middleware"
import { NoopSsrStrategy, ViteSsrStrategy, type SsrStrategy } from "./ssr/index"
import { runBuildPipeline } from "./build-pipeline"
import { reflectHttpApi, reflectRpcGroup, generateHttpClientBody, generateRpcClientBody } from "./reflection-generator"
import { collectSchemas } from "./reflection-generator/schema-reflector"

const reflectionModuleQuery = "?vite-plugin-effect-reflect"

export class PluginOrchestrator {
  private resolvedConfig: ResolvedConfig | undefined

  constructor(
    private resolvedOptions: ResolvedPluginOptions,
    private readonly ssrStrategy: SsrStrategy,
  ) {}

  getOptions(): ResolvedPluginOptions {
    return this.resolvedOptions
  }

  getConfig(): ResolvedConfig {
    if (!this.resolvedConfig) {
      throw new Error("vite-plugin-effect config is not resolved yet")
    }
    return this.resolvedConfig
  }

  private async refreshEntries(config: ResolvedConfig) {
    const entries = await discoverEntriesFromServerEntry(this.resolvedOptions, config)
    this.resolvedOptions = { ...this.resolvedOptions, entries }
  }

  private async regenerateClient(config: ResolvedConfig, loadModule?: (id: string) => Promise<any>) {
    await this.refreshEntries(config)
    if (loadModule || config.command === "build") {
      await this.generateReflectionClient(config, loadModule)
    }
  }

  private async generateReflectionClient(config: ResolvedConfig, loadModule?: (id: string) => Promise<any>) {
    const serverEntry = this.resolvedOptions.serverEntry
    if (!serverEntry) return

    const clientPath = this.resolvedOptions.clientPath
    if (!clientPath || typeof clientPath !== "string") return

    const fs = await import("node:fs/promises")
    const fullPath = path.resolve(config.root, clientPath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })

    const httpEntries: Array<{ entry: any; apiInfo: any }> = []
    const rpcEntries: Array<{ entry: any; rpcInfo: any }> = []
    const schemaNames = new Map<Schema.Top, string>()
    const reflectionModule = await this.loadReflectionContracts(config, loadModule)
    await this.collectSchemaNamesFromSourceModules(config, schemaNames, loadModule)

    for (const entry of this.resolvedOptions.entries) {
      const module = entry.reflectionName ? reflectionModule : await this.loadEntryModule(config, entry, loadModule)
      if (!module) continue

      // Collect named schema exports from the module
      for (const [exportName, exportedValue] of Object.entries(module)) {
        if (isSchemaTop(exportedValue)) {
          schemaNames.set(exportedValue, exportName)
        }
      }

      const moduleExportName = entry.reflectionName ?? entry.exportName
      const exported = module[moduleExportName]
      if (!exported) {
        console.warn(`[vite-plugin-effect] Export ${moduleExportName} not found in ${entry.sharedPath}`)
        continue
      }

      if (entry.type === "http") {
        const apiInfo = reflectHttpApi(exported, entry.exportName, schemaNames)
        httpEntries.push({ entry, apiInfo })
      } else {
        const rpcInfo = reflectRpcGroup(exported, schemaNames)
        rpcEntries.push({ entry, rpcInfo })
      }
    }

    if (httpEntries.length === 0 && rpcEntries.length === 0) return

    const clientCode = this.buildCombinedClientCode(httpEntries, rpcEntries)
    await fs.writeFile(fullPath, clientCode, "utf8")
    if (isDtsEnabled(this.resolvedOptions)) {
      const dtsPath = path.resolve(config.root, this.resolvedOptions.dts)
      await fs.mkdir(path.dirname(dtsPath), { recursive: true })
      await fs.writeFile(dtsPath, generateVirtualClientDts(this.resolvedOptions, config, dtsPath), "utf8")
    }
  }

  private async loadReflectionContracts(config: ResolvedConfig, loadModule?: (id: string) => Promise<any>): Promise<any> {
    const serverEntry = this.resolvedOptions.serverEntry
    if (!serverEntry) return {}

    const serverEntryPath = path.resolve(config.root, serverEntry).replace(/\\/g, "/")
    const reflectionId = `${serverEntryPath}${reflectionModuleQuery}`
    try {
      if (loadModule) {
        return await loadModule(reflectionId)
      }
      return await this.importTemporaryReflectionModule(config, serverEntryPath)
    } catch (error) {
      console.warn(`[vite-plugin-effect] Failed to load reflection contracts: ${(error as Error).message}`)
      return {}
    }
  }

  private async importTemporaryReflectionModule(config: ResolvedConfig, sourcePath: string): Promise<any> {
    const fs = await import("node:fs/promises")
    const tempPath = path.join(
      path.dirname(sourcePath),
      `.vite-plugin-effect-reflect-${process.pid}-${Date.now()}.ts`
    )
    await fs.writeFile(tempPath, this.generateReflectionModuleSourceFromPath(sourcePath, config), "utf8")
    try {
      return await import(/* @vite-ignore */ `${pathToFileURL(tempPath).href}?t=${Date.now()}`)
    } finally {
      await fs.rm(tempPath, { force: true })
    }
  }

  private async loadEntryModule(
    config: ResolvedConfig,
    entry: { readonly sharedPath: string },
    loadModule?: (id: string) => Promise<any>
  ): Promise<any | undefined> {
    const modulePath = path.resolve(config.root, entry.sharedPath)
    try {
      return loadModule
        ? await loadModule(modulePath)
        : await import(/* @vite-ignore */ modulePath)
    } catch (error) {
      console.warn(`[vite-plugin-effect] Failed to import module for reflection: ${(error as Error).message}`)
      return undefined
    }
  }

  private async collectSchemaNamesFromSourceModules(
    config: ResolvedConfig,
    schemaNames: Map<Schema.Top, string>,
    loadModule?: (id: string) => Promise<any>
  ): Promise<void> {
    const sourcePaths = new Set(
      this.resolvedOptions.entries.map((entry) => entry.sharedPath)
    )

    for (const sourcePath of sourcePaths) {
      const module = await this.loadEntryModule(config, { sharedPath: sourcePath }, loadModule)
      if (!module) continue
      for (const [exportName, exportedValue] of Object.entries(module)) {
        if (isSchemaTop(exportedValue)) {
          schemaNames.set(exportedValue, exportName)
        }
      }
    }
  }

  private buildCombinedClientCode(
    httpEntries: Array<{ entry: any; apiInfo: any }>,
    rpcEntries: Array<{ entry: any; rpcInfo: any }>
  ): string {
    const hasHttp = httpEntries.length > 0
    const hasRpc = rpcEntries.length > 0

    const imports: Array<string> = [
      "/* eslint-disable */",
      "// Auto-generated by vite-plugin-effect. Do not edit manually.",
    ]

    if (hasHttp) {
      imports.push("import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiClient } from \"effect/unstable/httpapi\"")
    }
    if (hasRpc) {
      imports.push("import { RpcClient, RpcClientError, RpcGroup, Rpc as EffectRpc, RpcSerialization } from \"effect/unstable/rpc\"")
    }
    imports.push(hasRpc ? "import { Effect, Schema, Scope } from \"effect\"" : "import { Effect, Schema } from \"effect\"")
    imports.push("import { FetchHttpClient } from \"effect/unstable/http\"")
    imports.push(`import type { ${getClientTypeImports(httpEntries, rpcEntries).join(", ")} } from "vite-plugin-effect/client"`)

    // Collect all schemas and schema names from all entries to avoid duplicate declarations
    const allSchemas = [
      ...httpEntries.flatMap(e => e.apiInfo.schemas as Array<Schema.Top>),
      ...rpcEntries.flatMap(e => e.rpcInfo.schemas as Array<Schema.Top>)
    ]
    const allSchemaNames = new Map<Schema.Top, string>()
    for (const entry of httpEntries) {
      for (const [schema, name] of (entry.apiInfo.schemaNames ?? new Map()).entries()) {
        allSchemaNames.set(schema, name)
      }
    }
    for (const entry of rpcEntries) {
      for (const [schema, name] of (entry.rpcInfo.schemaNames ?? new Map()).entries()) {
        allSchemaNames.set(schema, name)
      }
    }
    const schemaRegistry = allSchemas.length > 0 ? collectSchemas(allSchemas, allSchemaNames) : undefined

    type ReflectedEntry = {
      readonly type: "http" | "rpc"
      readonly name: string
      readonly entry: any
      readonly info: any
      readonly effect: string
      readonly promise: string
      readonly contract: string
      readonly typeName: string
    }

    const reflectedEntries: Array<ReflectedEntry> = []
    const bodies: Array<string> = []
    const typeDecls: Array<string> = []
    const promiseDecls: Array<string> = []
    const methodTypeDecls: Array<string> = []
    const httpEntryBySource = new Map(httpEntries.map((item) => [item.entry, item]))
    const rpcEntryBySource = new Map(rpcEntries.map((item) => [item.entry, item]))

    for (const entry of this.resolvedOptions.entries) {
      const httpEntry = httpEntryBySource.get(entry)
      const rpcEntry = rpcEntryBySource.get(entry)
      const reflected = httpEntry
        ? { type: "http" as const, entry, info: httpEntry.apiInfo }
        : rpcEntry
          ? { type: "rpc" as const, entry, info: rpcEntry.rpcInfo }
          : undefined
      if (!reflected) continue

      const index = reflectedEntries.length
      const effectVarName = `__effectClient${index}`
      const promiseVarName = `__promiseClient${index}`
      const contractVarName = reflected.type === "http" ? `__httpApi${index}` : `__rpcGroup${index}`
      const typeName = `Entry${index}`

      if (reflected.type === "http") {
        bodies.push(generateHttpClientBody(reflected.info, {
          baseUrl: typeof entry.apiPrefix === "string" ? entry.apiPrefix : "/api",
          contractVarName
        }, effectVarName, schemaRegistry))
        typeDecls.push(`export type ${typeName}EffectClient = HttpApiClient.ForApi<typeof ${contractVarName}>`)
        promiseDecls.push(generateHttpPromiseClientDeclaration(promiseVarName, typeName, effectVarName, reflected.info.endpoints))
        methodTypeDecls.push(generateHttpMethodNamespaces(entry.name, typeName, reflected.info.endpoints))
      } else {
        bodies.push(generateRpcClientBody(reflected.info, {
          rpcPath: entry.rpcPath,
          contractVarName
        }, effectVarName, schemaRegistry))
        typeDecls.push(`export type ${typeName}EffectClient = RpcClient.FromGroup<typeof ${contractVarName}, RpcClientError.RpcClientError>`)
        promiseDecls.push(generateRpcPromiseClientDeclaration(promiseVarName, typeName, effectVarName, reflected.info.rpcs))
        methodTypeDecls.push(generateRpcMethodNamespaces(entry.name, typeName, reflected.info.rpcs))
      }

      typeDecls.push(`export type ${typeName}PromiseClient = AwaitableClient<${typeName}EffectClient>`)

      const entryTypeName = toPascalIdentifier(entry.name)
      if (entryTypeName) {
        typeDecls.push(`export type ${entryTypeName}EffectClient = ${typeName}EffectClient`)
        typeDecls.push(`export type ${entryTypeName}PromiseClient = ${typeName}PromiseClient`)
        typeDecls.push(`export type ${entryTypeName}Client = ${typeName}PromiseClient`)
      }

      reflectedEntries.push({
        type: reflected.type,
        name: entry.name,
        entry,
        info: reflected.info,
        effect: effectVarName,
        promise: promiseVarName,
        contract: contractVarName,
        typeName
      })
    }

    const effectClient =
      reflectedEntries.length === 1
        ? reflectedEntries[0]!.effect
        : `{ ${reflectedEntries.map((entry) => `${propertyKey(entry.name)}: ${entry.effect}`).join(", ")} }`

    const promiseClient =
      reflectedEntries.length === 1
        ? reflectedEntries[0]!.promise
        : `{ ${reflectedEntries.map((entry) => `${propertyKey(entry.name)}: ${entry.promise}`).join(", ")} }`

    const effectClientType =
      reflectedEntries.length === 1
        ? `${reflectedEntries[0]!.typeName}EffectClient`
        : `{ readonly ${reflectedEntries.map((entry) => `${propertyKey(entry.name)}: ${entry.typeName}EffectClient`).join("; readonly ")} }`
    const promiseClientType =
      reflectedEntries.length === 1
        ? `${reflectedEntries[0]!.typeName}PromiseClient`
        : `{ readonly ${reflectedEntries.map((entry) => `${propertyKey(entry.name)}: ${entry.typeName}PromiseClient`).join("; readonly ")} }`
    const clientType = this.resolvedOptions.clientKind === "effect" ? "EffectClient" : "PromiseClient"

    const clientVar = this.resolvedOptions.clientKind === "effect" ? effectClient : promiseClient

    const parts = [
      ...imports,
      "",
      schemaRegistry ? schemaRegistry.declarations.join("\n") : "",
      "",
      schemaRegistry ? schemaRegistry.typeAliases.join("\n") : "",
      "",
      ...bodies,
      "",
      hasHttp ? httpPromiseClientHelper : "",
      "",
      ...typeDecls,
      "",
      ...methodTypeDecls,
      "",
      `export type EffectClient = ${effectClientType}`,
      `export type PromiseClient = ${promiseClientType}`,
      `export type Client = ${clientType}`,
      "",
      ...promiseDecls,
      "",
      `export const effectClient: EffectClient = ${effectClient}`,
      `export const promiseClient: PromiseClient = ${promiseClient}`,
      `export const client: Client = ${clientVar}`,
    ]

    return parts.join("\n")
  }

  // -------------------------------------------------------------------------
  // Vite lifecycle hooks
  // -------------------------------------------------------------------------

  resolveViteConfig(config: UserConfig, env?: Pick<ConfigEnv, "command">): UserConfig | undefined {
    if (env?.command !== "build") return undefined

    const serverEntry = this.resolvedOptions.serverBuildEntry ?? this.resolvedOptions.serverEntry
    if (!serverEntry) return undefined

    const root = config.root ?? process.cwd()
    const serverOutDir = path.resolve(root, this.resolvedOptions.serverOutDir)

    return {
      builder: {
        buildApp: async (builder: ViteBuilder): Promise<void> => {
          const environments = Object.values(builder.environments)
          await Promise.all(
            environments.map((environment) => builder.build(environment))
          )
        },
      },
      environments: {
        client: {
          build: {
            emptyOutDir: false,
          },
        },
        server: {
          build: {
            ssr: true,
            emptyOutDir: false,
            outDir: serverOutDir,
            rollupOptions: {
              input: path.resolve(root, serverEntry),
              output: {
                entryFileNames: defaultBuiltServerEntryFileName,
                chunkFileNames: "chunks/[name]-[hash].js",
              },
              external: [
                "effect",
                /^effect\//,
                /^node:/,
              ],
            },
          },
        },
      },
    }
  }

  async onConfigResolved(config: ResolvedConfig): Promise<void> {
    this.resolvedConfig = config
    await this.regenerateClient(config)
  }

  resolveVirtualModuleId(id: string): string | undefined {
    if (isReflectionModuleId(id)) {
      return id
    }
    if (id === this.resolvedOptions.virtualModuleId) {
      return this.resolvedOptions.resolvedVirtualModuleId
    }
    if (id === this.resolvedOptions.virtualTypesModuleId) {
      return this.resolvedOptions.resolvedVirtualTypesModuleId
    }
    if (id.startsWith(`${this.resolvedOptions.virtualModuleId}/`)) {
      return `\0${id}`
    }
    return undefined
  }

  loadVirtualModule(id: string): string | undefined {
    if (isReflectionModuleId(id)) {
      return this.generateReflectionModuleSource(id)
    }
    if (id === this.resolvedOptions.resolvedVirtualModuleId) {
      return generateVirtualClientModule(this.resolvedOptions, this.getConfig())
    }
    if (id === this.resolvedOptions.resolvedVirtualTypesModuleId) {
      return generateVirtualTypesModule()
    }
    return undefined
  }

  private generateReflectionModuleSource(id: string): string {
    const sourcePath = id.slice(0, id.indexOf(reflectionModuleQuery))
    return this.generateReflectionModuleSourceFromPath(sourcePath, this.getConfig())
  }

  private generateReflectionModuleSourceFromPath(sourcePath: string, config: ResolvedConfig): string {
    const entries = this.resolvedOptions.entries.filter((entry) => {
      const entrySourcePath = entry.reflectionSourcePath ?? entry.sharedPath
      return path.resolve(config.root, entrySourcePath).replace(/\\/g, "/") === sourcePath
    })

    const importedEntries = entries.filter((entry) =>
      entry.reflectionName &&
      entry.exportName &&
      path.resolve(config.root, entry.sharedPath).replace(/\\/g, "/") !== sourcePath
    )
    const localEntries = entries.filter((entry) => !importedEntries.includes(entry))
    const importedExports = importedEntries
      .map((entry) => {
        const sharedPath = path.resolve(config.root, entry.sharedPath)
        const specifier = toTemporaryRelativeSpecifier(sourcePath, sharedPath)
        return `export { ${entry.exportName} as ${entry.reflectionName} } from ${JSON.stringify(specifier)}`
      })
      .join("\n")

    if (localEntries.length === 0) {
      return importedExports
    }

    const source = rewriteRelativeImportsForTemporaryModule(sourcePath, readFileSync(sourcePath, "utf8"))

    const declarations = localEntries
      .filter((entry) => entry.reflectionName && entry.reflectionExpression)
      .map((entry) => `const ${entry.reflectionName} = (${entry.reflectionExpression});`)
      .join("\n")
    const exports = localEntries
      .filter((entry) => entry.reflectionName && entry.reflectionExpression)
      .map((entry) => entry.reflectionName)

    if (exports.length === 0) {
      return source
    }

    return `${importedExports ? `${importedExports}\n` : ""}${source}

// Injected by vite-plugin-effect for client generation.
${declarations}
export { ${exports.join(", ")} }
`
  }

  async onBuildStart(): Promise<void> {
    await this.regenerateClient(this.getConfig())
  }

  async onCloseBundle(): Promise<void> {
    // Server build is handled by buildApp hook — no-op here
  }

  async onBuildApp(builder: ViteBuilder): Promise<void> {
    const config = this.getConfig()
    if (config.command !== "build") return

    const serverEntry = this.resolvedOptions.serverBuildEntry ?? this.resolvedOptions.serverEntry
    if (!serverEntry) return

    const serverEnv = builder.environments.server
    if (!serverEnv?.isBuilt) return

    await this.buildServer(config, builder)
  }

  private async buildServer(config: ResolvedConfig, builder?: ViteBuilder): Promise<void> {
    const serverEntry = this.resolvedOptions.serverBuildEntry ?? this.resolvedOptions.serverEntry
    if (!serverEntry) return

    const serverOutDir = path.resolve(config.root, this.resolvedOptions.serverOutDir)

    console.log(`[vite-plugin-effect] Building server to ${serverOutDir}`)

    try {
      await runBuildPipeline(config, this.resolvedOptions, serverOutDir, builder, this.ssrStrategy)
      console.log("[vite-plugin-effect] Server build complete")
    } catch (error) {
      console.error("[vite-plugin-effect] Server build failed:", error)
      throw error
    }
  }

  // -------------------------------------------------------------------------
  // Plugin facade
  // -------------------------------------------------------------------------

  toPlugin(): Plugin {
    const resolvedOptions = this.resolvedOptions

    return {
      name: "vite-plugin-effect",

      config: (config, env) => {
        return this.resolveViteConfig(config, env)
      },

      configResolved: async (config) => {
        await this.onConfigResolved(config)
      },

      resolveId: (id) => {
        return this.resolveVirtualModuleId(id)
      },

      load: (id) => {
        return this.loadVirtualModule(id)
      },

      configureServer: (server) => {
        const config = server.config
        if (!config) {
          server.middlewares.use((_req: any, _res: any, next: any) => next())
          return
        }
        this.resolvedConfig = config

        const middleware = createDevApiMiddleware(
          server,
          () => this.getOptions(),
          () => config,
          {
            onEntriesStale: async () => {
              await this.regenerateClient(config, (id) => server.ssrLoadModule(id))
            },
          }
        )
        server.middlewares.use(middleware)

        const ssrMiddleware = this.ssrStrategy.createDevMiddleware(
          server,
          () => this.getOptions(),
          () => config
        )
        if (ssrMiddleware) {
          server.middlewares.use(ssrMiddleware)
        }

        // Generate reflection client using Vite's SSR loader for TypeScript support
        this.regenerateClient(config, (id) => server.ssrLoadModule(id)).catch((err) => {
          console.warn(`[vite-plugin-effect] Reflection client generation failed: ${err.message}`)
        })
      },

      configurePreviewServer: (server) => {
        const middleware = createPreviewApiMiddleware(
          () => this.getOptions(),
          () => this.getConfig()
        )
        server.middlewares.use(middleware)
      },

      buildStart: async () => {
        await this.onBuildStart()
      },

      closeBundle: async () => {
        await this.onCloseBundle()
      },

      buildApp: {
        order: "post",
        handler: async (builder) => {
          await this.onBuildApp(builder)
        },
      },
    }
  }
}

function isSchemaTop(value: unknown): value is Schema.Top {
  return (
    value !== null &&
    (typeof value === "object" || typeof value === "function") &&
    "ast" in value &&
    (value as any).ast !== null &&
    typeof (value as any).ast === "object" &&
    "_tag" in (value as any).ast
  )
}

function isReflectionModuleId(id: string): boolean {
  return id.includes(reflectionModuleQuery)
}

function toTemporaryRelativeSpecifier(sourcePath: string, targetPath: string): string {
  const resolved = resolveExistingModulePath(targetPath) ?? targetPath
  let relative = path.relative(path.dirname(sourcePath), resolved).replace(/\\/g, "/")
  if (!relative.startsWith(".")) {
    relative = `./${relative}`
  }
  return relative
}

function rewriteRelativeImportsForTemporaryModule(sourcePath: string, source: string): string {
  return source
    .replace(
      /(\bfrom\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${resolveTemporaryImportSpecifier(sourcePath, specifier)}${suffix}`
    )
    .replace(
      /(\bimport\s*["'])(\.{1,2}\/[^"']+)(["'])/g,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${resolveTemporaryImportSpecifier(sourcePath, specifier)}${suffix}`
    )
}

function resolveTemporaryImportSpecifier(sourcePath: string, specifier: string): string {
  if (path.extname(specifier) !== "") {
    return specifier
  }

  const sourceDir = path.dirname(sourcePath)
  const absoluteBase = path.resolve(sourceDir, specifier)
  const resolved = resolveExistingModulePath(absoluteBase)
  if (!resolved) return specifier

  let relative = path.relative(sourceDir, resolved).replace(/\\/g, "/")
  if (!relative.startsWith(".")) {
    relative = `./${relative}`
  }
  return relative
}

function resolveExistingModulePath(absoluteBase: string): string | undefined {
  const candidates = [
    absoluteBase,
    `${absoluteBase}.ts`,
    `${absoluteBase}.tsx`,
    `${absoluteBase}.mts`,
    `${absoluteBase}.cts`,
    `${absoluteBase}.js`,
    `${absoluteBase}.mjs`,
    `${absoluteBase}.cjs`,
    path.join(absoluteBase, "index.ts"),
    path.join(absoluteBase, "index.tsx"),
    path.join(absoluteBase, "index.mts"),
    path.join(absoluteBase, "index.cts"),
    path.join(absoluteBase, "index.js"),
    path.join(absoluteBase, "index.mjs"),
    path.join(absoluteBase, "index.cjs"),
  ]

  for (const candidate of candidates) {
    try {
      const stat = statSync(candidate)
      if (stat.isFile()) return candidate
    } catch {
      // Try the next candidate.
    }
  }
  return undefined
}

const httpPromiseClientHelper = `const reservedRequestKeys = new Set<PropertyKey>(["payload", "params", "query", "headers", "responseMode"])

function normalizeRequest<Request>(request: Request | MethodPayload<Request>, hasArgument: boolean): Request {
  if (!hasArgument) {
    return undefined as Request
  }
  if (request === null || typeof request !== "object") {
    return { payload: request } as Request
  }
  for (const key of reservedRequestKeys) {
    if (key in request) return request as Request
  }
  return { payload: request } as Request
}`

function generateHttpPromiseClientDeclaration(
  promiseVarName: string,
  entryTypeName: string,
  effectVarName: string,
  endpoints: ReadonlyArray<{
    readonly name: string
    readonly groupIdentifier: string
    readonly groupTopLevel: boolean
  }>
): string {
  const topLevelMethods = endpoints.filter((endpoint) => endpoint.groupTopLevel)
  const groupedMethods = groupByKey(endpoints.filter((endpoint) => !endpoint.groupTopLevel), (endpoint) => endpoint.groupIdentifier)
  const entries: Array<string> = []

  for (const endpoint of topLevelMethods) {
    entries.push(generateHttpPromiseEndpointProperty(entryTypeName, effectVarName, endpoint))
  }

  for (const [groupIdentifier, groupEndpoints] of Object.entries(groupedMethods)) {
    const groupAccess = accessProperty(effectVarName, groupIdentifier)
    const methods = groupEndpoints
      .map((endpoint) => generateHttpPromiseEndpointProperty(entryTypeName, groupAccess, endpoint))
      .join(",\n    ")
    entries.push(`${propertyKey(groupIdentifier)}: {\n    ${methods}\n  }`)
  }

  return `const ${promiseVarName}: ${entryTypeName}PromiseClient = {\n  ${entries.join(",\n  ")}\n}`
}

function getClientTypeImports(
  httpEntries: ReadonlyArray<{ readonly apiInfo: { readonly endpoints: ReadonlyArray<{
    readonly params?: unknown
    readonly query?: unknown
    readonly payload?: unknown
    readonly headers?: unknown
    readonly error?: unknown
  }> } }>,
  rpcEntries: ReadonlyArray<{ readonly rpcInfo: { readonly rpcs: ReadonlyArray<{
    readonly payload?: unknown
    readonly error?: unknown
  }> } }>
): ReadonlyArray<string> {
  const imports = new Set(["AwaitableClient", "MethodInput", "MethodSuccess"])
  const httpEndpoints = httpEntries.flatMap((entry) => entry.apiInfo.endpoints)
  const rpcs = rpcEntries.flatMap((entry) => entry.rpcInfo.rpcs)

  if (httpEntries.length > 0 || httpEndpoints.some((endpoint) => endpoint.payload) || rpcs.some((rpc) => rpc.payload)) {
    imports.add("MethodPayload")
  }
  if (httpEndpoints.some((endpoint) => endpoint.params)) imports.add("MethodParams")
  if (httpEndpoints.some((endpoint) => endpoint.query)) imports.add("MethodQuery")
  if (httpEndpoints.some((endpoint) => endpoint.headers)) imports.add("MethodHeaders")
  if (httpEndpoints.some((endpoint) => endpoint.error) || rpcs.some((rpc) => rpc.error)) {
    imports.add("MethodError")
  }

  return Array.from(imports).sort()
}

function generateHttpPromiseEndpointProperty(
  entryTypeName: string,
  effectContainer: string,
  endpoint: {
    readonly name: string
    readonly groupIdentifier: string
    readonly groupTopLevel: boolean
  }
): string {
  const methodType = getHttpMethodType(entryTypeName, endpoint)
  const effectMethod = accessProperty(effectContainer, endpoint.name)
  return `${propertyKey(endpoint.name)}: (...args) => Effect.runPromise(${effectMethod}(normalizeRequest<MethodInput<${methodType}>>(args[0], args.length > 0)))`
}

function generateRpcPromiseClientDeclaration(
  promiseVarName: string,
  entryTypeName: string,
  effectVarName: string,
  rpcs: ReadonlyArray<{ readonly tag: string }>
): string {
  const entries = rpcs
    .map((rpc) => {
      const effectMethod = accessProperty(effectVarName, rpc.tag)
      return `${propertyKey(rpc.tag)}: (payload, options) => Effect.runPromise(${effectMethod}(payload, options))`
    })
    .join(",\n  ")
  return `const ${promiseVarName}: ${entryTypeName}PromiseClient = {\n  ${entries}\n}`
}

function generateHttpMethodNamespaces(
  entryName: string,
  entryTypeName: string,
  endpoints: ReadonlyArray<{
    readonly name: string
    readonly groupIdentifier: string
    readonly groupTopLevel: boolean
    readonly params?: unknown
    readonly query?: unknown
    readonly payload?: unknown
    readonly headers?: unknown
    readonly error?: unknown
  }>
): string {
  const namespaceName = toPascalIdentifier(entryName) || toNamespaceIdentifier(entryName, entryTypeName)
  const topLevelMethods = endpoints.filter((endpoint) => endpoint.groupTopLevel)
  const groupedMethods = groupByKey(endpoints.filter((endpoint) => !endpoint.groupTopLevel), (endpoint) => endpoint.groupIdentifier)
  const parts: Array<string> = []
  const usedTopLevelNames = new Set<string>()

  for (const endpoint of topLevelMethods) {
    const methodNamespace = allocateNamespaceName(toNamespaceIdentifier(endpoint.name, "endpoint"), usedTopLevelNames)
    parts.push(generateHttpEndpointNamespace(methodNamespace, entryTypeName, endpoint))
  }

  const usedGroupNames = new Set<string>()
  for (const [groupIdentifier, groupEndpoints] of Object.entries(groupedMethods)) {
    const groupNamespace = allocateNamespaceName(toNamespaceIdentifier(groupIdentifier, "group"), usedGroupNames)
    const usedEndpointNames = new Set<string>()
    const endpointNamespaces = groupEndpoints.map((endpoint) =>
      generateHttpEndpointNamespace(
        allocateNamespaceName(toNamespaceIdentifier(endpoint.name, "endpoint"), usedEndpointNames),
        entryTypeName,
        endpoint
      )
    )
    parts.push(`export namespace ${groupNamespace} {\n${indent(endpointNamespaces.join("\n\n"), 2)}\n}`)
  }

  return `export namespace ${namespaceName} {\n${indent(parts.join("\n\n"), 2)}\n}`
}

function generateHttpEndpointNamespace(
  namespaceName: string,
  entryTypeName: string,
  endpoint: {
    readonly name: string
    readonly groupIdentifier: string
    readonly groupTopLevel: boolean
    readonly params?: unknown
    readonly query?: unknown
    readonly payload?: unknown
    readonly headers?: unknown
    readonly error?: unknown
  }
): string {
  const methodType = getHttpMethodType(entryTypeName, endpoint)
  const aliases = [
    `type Method = ${methodType}`,
    "export type Input = MethodInput<Method>",
  ]
  if (endpoint.params) aliases.push("export type Params = MethodParams<Input>")
  if (endpoint.query) aliases.push("export type Query = MethodQuery<Input>")
  if (endpoint.payload) aliases.push("export type Payload = MethodPayload<Input>")
  if (endpoint.headers) aliases.push("export type Headers = MethodHeaders<Input>")
  aliases.push("export type Success = MethodSuccess<Method>")
  if (endpoint.error) aliases.push("export type Error = MethodError<Method>")
  return `export namespace ${namespaceName} {\n${indent(aliases.join("\n"), 2)}\n}`
}

function generateRpcMethodNamespaces(
  entryName: string,
  entryTypeName: string,
  rpcs: ReadonlyArray<{
    readonly tag: string
    readonly payload?: unknown
    readonly error?: unknown
  }>
): string {
  const namespaceName = toPascalIdentifier(entryName) || toNamespaceIdentifier(entryName, entryTypeName)
  const usedRpcNames = new Set<string>()
  const rpcNamespaces = rpcs.map((rpc) =>
    generateRpcNamespace(
      allocateNamespaceName(toNamespaceIdentifier(rpc.tag, "rpc"), usedRpcNames),
      entryTypeName,
      rpc
    )
  )
  return `export namespace ${namespaceName} {\n${indent(rpcNamespaces.join("\n\n"), 2)}\n}`
}

function generateRpcNamespace(
  namespaceName: string,
  entryTypeName: string,
  rpc: {
    readonly tag: string
    readonly payload?: unknown
    readonly error?: unknown
  }
): string {
  const aliases = [
    `type Method = ${entryTypeName}EffectClient[${JSON.stringify(rpc.tag)}]`,
    "export type Input = MethodInput<Method>",
  ]
  if (rpc.payload) aliases.push("export type Payload = MethodPayload<Input>")
  aliases.push("export type Success = MethodSuccess<Method>")
  if (rpc.error) aliases.push("export type Error = MethodError<Method>")
  return `export namespace ${namespaceName} {\n${indent(aliases.join("\n"), 2)}\n}`
}

function allocateNamespaceName(baseName: string, usedNames: Set<string>): string {
  const normalized = baseName || "method"
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized)
    return normalized
  }

  let suffix = 1
  let candidate = `${normalized}${suffix}`
  while (usedNames.has(candidate)) {
    suffix++
    candidate = `${normalized}${suffix}`
  }
  usedNames.add(candidate)
  return candidate
}

function toNamespaceIdentifier(name: string, fallback: string): string {
  if (isValidIdentifier(name) && !reservedTypeScriptWords.has(name)) return name
  const pascal = toPascalIdentifier(name)
  if (pascal && !reservedTypeScriptWords.has(pascal)) return pascal
  return fallback
}

function getHttpMethodType(
  entryTypeName: string,
  endpoint: {
    readonly name: string
    readonly groupIdentifier: string
    readonly groupTopLevel: boolean
  }
): string {
  return endpoint.groupTopLevel
    ? `${entryTypeName}EffectClient[${JSON.stringify(endpoint.name)}]`
    : `${entryTypeName}EffectClient[${JSON.stringify(endpoint.groupIdentifier)}][${JSON.stringify(endpoint.name)}]`
}

function accessProperty(base: string, key: string): string {
  return isValidIdentifier(key) ? `${base}.${key}` : `${base}[${JSON.stringify(key)}]`
}

function groupByKey<T, K extends string>(
  values: ReadonlyArray<T>,
  getKey: (value: T) => K
): Record<K, Array<T>> {
  const grouped = {} as Record<K, Array<T>>
  for (const value of values) {
    const key = getKey(value)
    grouped[key] ??= []
    grouped[key].push(value)
  }
  return grouped
}

function propertyKey(name: string): string {
  return isValidIdentifier(name) ? name : JSON.stringify(name)
}

function toPascalIdentifier(name: string): string {
  const normalized = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("")
    .replace(/^[0-9]+/, "")
  if (!normalized || normalized === "Effect" || normalized === "Promise") return ""
  return normalized
}

function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(name)
}

function indent(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces)
  return value.split("\n").map((line) => line ? `${prefix}${line}` : line).join("\n")
}

const reservedTypeScriptWords = new Set([
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "as",
  "implements",
  "interface",
  "let",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "yield",
])

export function createPlugin(options: VitePluginEffectOptions): Plugin {
  const resolvedOptions = resolveOptions(options)
  const ssrStrategy = isSsrEnabled(resolvedOptions) ? new ViteSsrStrategy() : new NoopSsrStrategy()
  const orchestrator = new PluginOrchestrator(resolvedOptions, ssrStrategy)
  return orchestrator.toPlugin()
}
