// ---------------------------------------------------------------------------
// Server Platform Abstraction — decouples runtime logic from Node.js specifics
// ---------------------------------------------------------------------------

export interface PlatformHttpRequest {
  readonly url: string
  readonly method: string
  readonly headers: Headers
  readonly body: ReadableStream<Uint8Array> | null
}

export interface PlatformHttpResponse {
  readonly status: number
  readonly headers: Headers
  readonly body: ReadableStream<Uint8Array> | null
}

export type RequestHandler = (request: PlatformHttpRequest) => Promise<PlatformHttpResponse>

export interface ServerPlatform {
  readonly name: string

  /**
   * Create a request handler that loads the Effect server layer and routes
   * API/RPC requests. The returned handler is platform-agnostic; the platform
   * adapter wraps it for the specific runtime (node:http, fetch, etc.).
   */
  createRequestHandler(config: RuntimeConfig): RequestHandler

  /**
   * Serve static files. Returns null if the request should be handled by
   * the Effect layer instead.
   */
  serveStatic?(
    request: PlatformHttpRequest,
    staticRoot: string,
    spaFallback: boolean
  ): Promise<PlatformHttpResponse | null>

  /**
   * SSR render hook. Returns null if SSR is not applicable.
   */
  renderSsr?(
    request: PlatformHttpRequest,
    ssrEntryUrl: string,
    staticRoot: string
  ): Promise<PlatformHttpResponse | null>
}

export interface RuntimeConfig {
  readonly serverEntryUrl: string
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
