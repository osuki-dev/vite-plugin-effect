import { HttpRouter, HttpServerRequest, HttpServerResponse, HttpMiddleware } from "effect/unstable/http"
import { Effect, Context, Scope, Layer, Exit } from "effect"

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
  exportNames: ReadonlyArray<string>,
  platform?: "node" | "cloudflare"
): Promise<LoadedApi> => {
  if (typeof moduleValue.handler === "function") {
    return { type: "node", handler: moduleValue.handler, dispose: undefined }
  }

  const appLayer = pickServerExport(moduleValue, exportNames)
  if (!appLayer) {
    throw new Error("vite-plugin-effect: built server entry must export one of " + exportNames.join(", "))
  }

  if (platform === "cloudflare") {
    // Cloudflare Workers workaround: Effect.runForkWith / Effect.forkScoped
    // fibers never resume in the workerd runtime, causing RPC requests to hang
    // indefinitely. See: https://github.com/Effect-TS/effect-smol/issues/2179
    // We avoid the default HttpRouter.toWebHandler (which uses runForkWith)
    // and instead build the layer once, then run each request with
    // Effect.runPromise + a fresh request-scoped context.
    const scope = Scope.makeUnsafe()
    const dispose = () => Effect.runPromise(Scope.close(scope, Exit.void))

    const routerLayer = (HttpRouter as any).layer ?? Layer.effect(HttpRouter as any)((HttpRouter as any).make)
    const mergedLayer = Layer.provideMerge(appLayer as any, routerLayer as any)
    const context = await Effect.runPromise(Layer.buildWithScope(mergedLayer as any, scope))

    const router = Context.get(context as any, HttpRouter as any)
    const httpApp = router.asHttpEffect()
    const appWithMiddleware = httpApp.pipe(HttpMiddleware.logger)

    const handler = async (request: Request) => {
      const serverRequest = HttpServerRequest.fromWeb(request)
      const requestContext = Context.add(context as any, HttpServerRequest.key, serverRequest)

      const response = await Effect.runPromise(
        Effect.provideContext(appWithMiddleware, requestContext as any)
      )

      return HttpServerResponse.toWeb(response, {
        withoutBody: request.method === "HEAD"
      })
    }

    return { type: "web", handler, dispose }
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
