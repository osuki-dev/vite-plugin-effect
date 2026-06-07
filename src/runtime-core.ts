// ---------------------------------------------------------------------------
// Runtime Core — platform-agnostic request handling for production servers
// ---------------------------------------------------------------------------

import { rewriteRequestUrl, matchPluginRequest, type RequestMount } from "./mounts"
import { loadServerApi, type LoadedApi } from "./server-api"
import type { ResolvedClientEntry } from "./options"

export interface RuntimeConfig {
  readonly serverEntryUrl?: string
  readonly serverModule?: Record<string, unknown>
  readonly staticRoot: string
  readonly serverExports: ReadonlyArray<string>
  readonly entries: ReadonlyArray<RuntimeEntry>
  readonly defaultHost: string
  readonly defaultPort: number
  readonly spaFallback: boolean
  readonly ssrEntryUrl?: string
}

export interface RuntimeEntry {
  readonly type: "http" | "rpc"
  readonly apiPrefix: string | { readonly regexp: { readonly source: string; readonly flags: string } }
  readonly rpcPath: string
}

let loadedApi: LoadedApi | null = null
let loadedSource: unknown = null

export async function getLoadedApi(config: RuntimeConfig): Promise<LoadedApi> {
  const source = config.serverModule ?? config.serverEntryUrl
  if (loadedApi && loadedSource === source) {
    return loadedApi
  }
  const serverModule = config.serverModule ?? await importServerModule(config)
  loadedApi = await loadServerApi(serverModule, config.serverExports)
  loadedSource = source
  return loadedApi
}

export async function disposeApi(): Promise<void> {
  if (loadedApi?.dispose) {
    await loadedApi.dispose()
  }
  loadedApi = null
  loadedSource = null
}

export async function handleRuntimeRequest(
  config: RuntimeConfig,
  request: Request,
  url: URL
): Promise<Response | null> {
  const matchedEntry = matchRuntimeEntry(config.entries, url.pathname)
  if (matchedEntry) {
    const api = await getLoadedApi(config)
    const clientEntry = toClientEntry(matchedEntry)
    rewriteRequestUrl(clientEntry, url)
    const webRequest = rewriteRuntimeRequest(request, url)
    return (api.handler as (request: Request) => Promise<Response>)(webRequest)
  }
  return null
}

function rewriteRuntimeRequest(request: Request, url: URL): Request {
  if (request instanceof Request) {
    return new Request(url.toString(), request)
  }

  const requestLike = request as any
  const init: RequestInit = {
    method: requestLike.method,
    headers: requestLike.headers,
  }
  if (requestLike.method !== "GET" && requestLike.method !== "HEAD") {
    init.body = requestLike.body
  }
  return new Request(url.toString(), init)
}

async function importServerModule(config: RuntimeConfig): Promise<Record<string, unknown>> {
  if (!config.serverEntryUrl) {
    throw new Error("vite-plugin-effect: runtime config requires serverEntryUrl or serverModule")
  }
  return await import(/* @vite-ignore */ config.serverEntryUrl)
}

export function matchRuntimeEntry(
  entries: ReadonlyArray<RuntimeEntry>,
  pathname: string
): RuntimeEntry | undefined {
  const clientEntries = entries.map(toClientEntry)
  const matched = matchPluginRequest(clientEntries, pathname)
  if (!matched) return undefined
  return entries[clientEntries.indexOf(matched)]
}

function toClientEntry(entry: RuntimeEntry): ResolvedClientEntry {
  return {
    type: entry.type,
    name: entry.type === "http" ? "api" : "rpc",
    sharedPath: "",
    exportName: "",
    apiPrefix: typeof entry.apiPrefix === "string"
      ? entry.apiPrefix
      : new RegExp(entry.apiPrefix.regexp.source, entry.apiPrefix.regexp.flags),
    rpcPath: entry.rpcPath,
  }
}
