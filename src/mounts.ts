/**
 * Request mount Module — owns request match, backend URL rewrite,
 * frontend base URL, and RPC slash policy.
 */

import type { ResolvedClientEntry } from "./options"
import { defaultApiPrefix, defaultRpcPath } from "./defaults"

export interface RequestMount {
  match(pathname: string): boolean
  toFrontendBaseUrl(): string
  rewriteBackendPath(url: URL): void
}

export const createHttpMount = (prefix: string | RegExp): RequestMount => {
  if (prefix instanceof RegExp) {
    return {
      match: (pathname) => prefix.test(pathname),
      toFrontendBaseUrl: () => defaultApiPrefix,
      rewriteBackendPath: () => {},
    }
  }

  return {
    match: (pathname) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`),
    toFrontendBaseUrl: () => prefix,
    rewriteBackendPath: (url) => {
      if (url.pathname === prefix) {
        url.pathname = "/"
      } else if (url.pathname.startsWith(`${prefix}/`)) {
        url.pathname = url.pathname.slice(prefix.length)
      }
    },
  }
}

export const createRpcMount = (rpcPath: string): RequestMount => {
  const normalized = normalizeTrailingSlash(rpcPath)
  return {
    match: (pathname) =>
      pathname === normalized || pathname === `${normalized}/`,
    toFrontendBaseUrl: () => rpcPath,
    rewriteBackendPath: (url) => {
      if (url.pathname === `${normalized}/`) {
        url.pathname = normalized
      }
    },
  }
}

export const getMount = (entry: ResolvedClientEntry): RequestMount => {
  if (entry.type === "http") {
    return createHttpMount(entry.apiPrefix)
  }
  return createRpcMount(entry.rpcPath)
}

export const matchPluginRequest = (
  entries: ReadonlyArray<ResolvedClientEntry>,
  url: string
): ResolvedClientEntry | undefined => {
  const pathname = safePathname(url)
  for (const entry of entries) {
    const mount = getMount(entry)
    if (mount.match(pathname)) return entry
  }
  return undefined
}

export const isPluginRequest = (
  entries: ReadonlyArray<ResolvedClientEntry>,
  url: string
): boolean => matchPluginRequest(entries, url) !== undefined

export const rewriteRequestUrl = (
  entry: ResolvedClientEntry,
  url: URL
): void => {
  getMount(entry).rewriteBackendPath(url)
}

export const toFrontendBaseUrl = (entry: ResolvedClientEntry): string => {
  if (entry.type === "http" && typeof entry.apiPrefix === "string") {
    return entry.apiPrefix
  }
  if (entry.type === "rpc") {
    return entry.rpcPath
  }
  return defaultApiPrefix
}

export const safePathname = (url: string): string => {
  try {
    return new URL(url, "http://localhost").pathname
  } catch {
    return url
  }
}

export const normalizeTrailingSlash = (pathname: string): string => {
  if (pathname === "/") return pathname
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname
}
