import {
  defaultApiPrefix,
  defaultClientKind,
  defaultClientPath,
  defaultDtsPath,
  defaultEntryName,
  defaultHttpExportName,
  defaultMode,
  defaultProductionServerEntry,
  defaultProductionServerHost,
  defaultProductionServerPort,
  defaultProductionServerSpaFallback,
  defaultRpcExportName,
  defaultRpcPath,
  defaultServerExports,
  defaultServerOutDir,
  defaultSsrEntry,
  defaultVirtualModuleId,
} from "./defaults"

export type EffectApiMode = "http" | "rpc"
export type ClientKind = "effect" | "promise"
export type ServerPlatform = "node" | "cloudflare"

export interface HttpClientEntry {
  type: "http"
  /**
   * Namespace used when more than one entry is configured.
   */
  name?: string
  sharedPath: string
  exportName?: string
  apiPrefix?: string | RegExp
}

export interface RpcClientEntry {
  type: "rpc"
  /**
   * Namespace used when more than one entry is configured.
   */
  name?: string
  sharedPath: string
  exportName?: string
  rpcPath?: string
}

export type ClientEntry = HttpClientEntry | RpcClientEntry

export interface VirtualModuleContentOptions {
  entry: ResolvedClientEntry
  entries: ReadonlyArray<ResolvedClientEntry>
  clientKind: ClientKind
}

export interface ProductionServerOptions {
  /**
   * Runtime entry emitted inside `serverOutDir`.
   * @default 'index.js'
   */
  entry?: string

  /**
   * Fallback listen host. Runtime HOST env overrides this value.
   * @default '0.0.0.0'
   */
  host?: string

  /**
   * Fallback listen port. Runtime PORT env overrides this value.
   * @default 3000
   */
  port?: number

  /**
   * Serve index.html for extensionless HTML requests that miss static files.
   * @default true
   */
  spaFallback?: boolean

  /**
   * Deployment target platform. Node.js creates a standalone HTTP server.
   * Cloudflare Workers generates a `fetch` event handler.
   * @default 'node'
   */
  platform?: ServerPlatform
}

export interface SsrOptions {
  /**
   * SSR entry file that exports a `render()` function.
   * @default 'src/entry-server.tsx'
   */
  entry?: string

  /**
   * External packages for the SSR bundle build.
   * Framework-specific packages (react, vue, svelte, etc.) should be listed here.
   * @default []
   */
  external?: ReadonlyArray<string | RegExp>
}

export interface VitePluginEffectOptions {
  /**
   * Explicit HTTP/RPC client entries. Use this for fullstack apps that expose
   * HTTP API and RPC from the same MainLive/ServerLive.
   */
  entries?: ReadonlyArray<ClientEntry>

  /**
   * Default export strategy for `client`.
   * - `effect`: `client` is the official Effect client and methods return Effect/Stream
   * - `promise`: `client` is a plain Promise client, generated from the Effect client
   * @default 'promise'
   */
  clientKind?: ClientKind

  /**
   * Back-compat single-entry API mode.
   * @default 'http'
   */
  mode?: EffectApiMode

  apiPrefix?: string | RegExp
  rpcPath?: string
  sharedPath?: string
  exportName?: string

  virtualModuleId?: string

  virtualModuleContent?: (options: VirtualModuleContentOptions) => string

  /**
   * Generated strongly typed client file.
   * @default 'src/effect-client.ts'
   */
  clientPath?: string | false

  /**
   * Generated declaration shim for the virtual client module.
   * @default 'src/effect-client.virtual.d.ts'
   */
  dts?: string | false

  /**
   * Dev server backend entry. The plugin looks for MainLive, ServerLive, default,
   * or a legacy handler(req, res).
   */
  serverEntry?: string

  /**
   * Server layer export names to try, in order.
   * @default ['MainLive', 'ServerLive', 'default']
   */
  serverExport?: string | ReadonlyArray<string>

  serverBuildEntry?: string
  serverOutDir?: string

  /**
   * Emits a runnable fullstack server after build. The generated server loads
   * the built Effect server layer, handles configured API/RPC mounts, and serves
   * Vite's built static assets.
   *
   * Set false to only build the server layer bundle.
   * @default enabled when serverEntry/serverBuildEntry is configured
   */
  productionServer?: false | ProductionServerOptions

  /**
   * Enable SSR for the React app. When enabled, the plugin will:
   * - In dev: intercept HTML requests and render the app server-side
   * - In production: build an SSR bundle and serve pre-rendered HTML
   */
  ssr?: false | SsrOptions
}

export interface ResolvedClientEntry {
  type: EffectApiMode
  name: string
  sharedPath: string
  exportName: string
  apiPrefix: string | RegExp
  rpcPath: string
}

export interface ResolvedPluginOptions {
  entries: ReadonlyArray<ResolvedClientEntry>
  clientKind: ClientKind
  virtualModuleId: string
  resolvedVirtualModuleId: string
  virtualTypesModuleId: string
  resolvedVirtualTypesModuleId: string
  virtualModuleContent?: (options: VirtualModuleContentOptions) => string
  clientPath: string | false
  dts: string | false
  serverEntry?: string
  serverExports: ReadonlyArray<string>
  serverBuildEntry?: string
  serverOutDir: string
  productionServer: false | ResolvedProductionServerOptions
  ssr: false | ResolvedSsrOptions
}

export interface ResolvedSsrOptions {
  entry: string
  external: ReadonlyArray<string | RegExp>
}

export interface ResolvedProductionServerOptions {
  entry: string
  host: string
  port: number
  spaFallback: boolean
  platform: ServerPlatform
}

export const resolveOptions = (options: VitePluginEffectOptions): ResolvedPluginOptions => {
  const virtualModuleId = options.virtualModuleId ?? defaultVirtualModuleId
  const entries = resolveEntries(options)
  const serverExports = Array.isArray(options.serverExport)
    ? options.serverExport
    : options.serverExport
      ? [options.serverExport]
      : [...defaultServerExports]

  const ssr = resolveSsr(options.ssr)

  return {
    entries,
    clientKind: options.clientKind ?? defaultClientKind,
    virtualModuleId,
    resolvedVirtualModuleId: `\0${virtualModuleId}`,
    virtualTypesModuleId: `${virtualModuleId}?types`,
    resolvedVirtualTypesModuleId: `\0${virtualModuleId}?types`,
    virtualModuleContent: options.virtualModuleContent,
    clientPath: options.clientPath ?? defaultClientPath,
    dts: options.dts ?? defaultDtsPath,
    serverEntry: options.serverEntry,
    serverExports,
    serverBuildEntry: options.serverBuildEntry,
    serverOutDir: options.serverOutDir ?? defaultServerOutDir,
    productionServer: resolveProductionServer(options.productionServer),
    ssr,
  }
}

const resolveSsr = (
  options: VitePluginEffectOptions["ssr"]
): false | ResolvedSsrOptions => {
  if (options === false || options === undefined) return false
  return {
    entry: options.entry ?? defaultSsrEntry,
    external: options.external ?? [],
  }
}

const resolveProductionServer = (
  options: VitePluginEffectOptions["productionServer"]
): false | ResolvedProductionServerOptions => {
  if (options === false) return false
  return {
    entry: options?.entry ?? defaultProductionServerEntry,
    host: options?.host ?? defaultProductionServerHost,
    port: options?.port ?? defaultProductionServerPort,
    spaFallback: options?.spaFallback ?? defaultProductionServerSpaFallback,
    platform: options?.platform ?? "node",
  }
}

const resolveEntries = (options: VitePluginEffectOptions): ReadonlyArray<ResolvedClientEntry> => {
  if (options.entries && options.entries.length > 0) {
    return options.entries.map(resolveEntry)
  }

  if (!options.sharedPath) {
    return []
  }

  const mode = options.mode ?? defaultMode
  return [
    resolveEntry({
      type: mode,
      name: mode === "http" ? "api" : "rpc",
      sharedPath: options.sharedPath,
      exportName: options.exportName,
      apiPrefix: options.apiPrefix,
      rpcPath: options.rpcPath,
    } as ClientEntry),
  ]
}

const resolveEntry = (entry: ClientEntry): ResolvedClientEntry => ({
  type: entry.type,
  name: entry.name ?? defaultEntryName(entry.type),
  sharedPath: entry.sharedPath,
  exportName: entry.exportName ?? (entry.type === "http" ? defaultHttpExportName : defaultRpcExportName),
  apiPrefix: entry.type === "http" ? entry.apiPrefix ?? defaultApiPrefix : defaultApiPrefix,
  rpcPath: entry.type === "rpc" ? entry.rpcPath ?? defaultRpcPath : defaultRpcPath,
})

export { resolveProjectPath } from "./path-utils"

// ---------------------------------------------------------------------------
// Boolean helpers — centralize scattered checks
// ---------------------------------------------------------------------------

export const isSsrEnabled = (
  options: ResolvedPluginOptions,
): options is ResolvedPluginOptions & { ssr: ResolvedSsrOptions } =>
  options.ssr !== false

export const isProductionServerEnabled = (
  options: ResolvedPluginOptions,
): options is ResolvedPluginOptions & { productionServer: ResolvedProductionServerOptions } =>
  options.productionServer !== false

export const isClientPathEnabled = (
  options: ResolvedPluginOptions,
): options is ResolvedPluginOptions & { clientPath: string } =>
  options.clientPath !== false

export const isDtsEnabled = (
  options: ResolvedPluginOptions,
): options is ResolvedPluginOptions & { dts: string } =>
  options.dts !== false
