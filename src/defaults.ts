/**
 * Plugin default policy — one deep module for all configuration defaults.
 *
 * All default values used across discovery, codegen, middleware, and tests
 * live here. Changing a default changes it once.
 */

export const defaultVirtualModuleId = "virtual:effect/client" as const

export const defaultClientKind = "promise" as const
export const defaultClientPath = "src/effect-client.ts" as const
export const defaultDtsPath = "src/effect-client.virtual.d.ts" as const
export const defaultDtsFallbackPath = "src/vite-plugin-effect.d.ts" as const

export const defaultServerExports = ["MainLive", "ServerLive", "default"] as const
export const defaultServerOutDir = "dist/server" as const
export const defaultBuiltServerEntryFileName = "server-entry.js" as const
export const defaultProductionServerEntry = "index.js" as const
export const defaultProductionServerHost = "0.0.0.0" as const
export const defaultProductionServerPort = 3000 as const
export const defaultProductionServerSpaFallback = true as const
export const defaultSsrEntry = "src/entry-server.tsx" as const

export const defaultApiPrefix = "/api" as const
export const defaultRpcPath = "/rpc" as const

export const defaultHttpExportName = "MyApi" as const
export const defaultRpcExportName = "router" as const

export const defaultMode = "http" as const
export const defaultEntryName = (type: "http" | "rpc"): string =>
  type === "http" ? "api" : "rpc"
