import { HttpRouter } from "effect/unstable/http"

// ---------------------------------------------------------------------------
// Server API loading
// ---------------------------------------------------------------------------

export interface LoadedApi {
  readonly type: "node" | "web"
  readonly handler: unknown
  readonly dispose?: (() => Promise<void>)
}

export const loadServerApi = async (
  moduleValue: Record<string, unknown>,
  exportNames: ReadonlyArray<string>
): Promise<LoadedApi> => {
  if (typeof moduleValue.handler === "function") {
    return { type: "node", handler: moduleValue.handler, dispose: undefined }
  }

  const appLayer = pickServerExport(moduleValue, exportNames)
  if (!appLayer) {
    throw new Error("vite-plugin-effect: built server entry must export one of " + exportNames.join(", "))
  }

  const web = HttpRouter.toWebHandler(appLayer as any)
  return { type: "web", handler: web.handler, dispose: web.dispose }
}

const pickServerExport = (
  serverModule: Record<string, unknown>,
  exportNames: ReadonlyArray<string>
): unknown => {
  for (const exportName of exportNames) {
    if (serverModule[exportName]) return serverModule[exportName]
  }
}
