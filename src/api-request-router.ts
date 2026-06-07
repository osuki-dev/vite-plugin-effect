import type { IncomingMessage, ServerResponse } from "node:http"
import type { ResolvedConfig } from "vite"
import type { ResolvedPluginOptions } from "./options"
import { matchPluginRequest } from "./mounts"
import { handleApiRequest, sendJson } from "./server-runtime"
import type { ServerLoader } from "./server-loader"

export type Next = () => void

export class ApiRequestRouter {
  constructor(
    private readonly loader: ServerLoader,
    private readonly getOptions: () => ResolvedPluginOptions,
    private readonly getConfig: () => ResolvedConfig,
    private readonly errorHandler?: (error: Error) => void
  ) {}

  async route(req: IncomingMessage, res: ServerResponse, next: Next): Promise<void> {
    const options = this.getOptions()
    const requestUrl = req.url || "/"
    const matchedEntry = matchPluginRequest(options.entries, requestUrl)
    if (!matchedEntry) {
      next()
      return
    }

    try {
      const api = await this.loader.load()
      if (!api.handler) {
        sendJson(res, 200, {
          ok: true,
          message: "vite-plugin-effect is running",
          entries: options.entries.map((entry) => entry.type),
          url: requestUrl,
        })
        return
      }

      const response = await handleApiRequest(api, matchedEntry, req, res)
      if (response.status === 404) {
        next()
        return
      }
    } catch (error) {
      this.errorHandler?.(error as Error)
      res.writeHead(500)
      res.end((error as Error).stack || "Effect Server Error")
    }
  }
}
