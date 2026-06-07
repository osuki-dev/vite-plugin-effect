import { readFile, stat } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import * as path from "node:path"

export interface SsrRenderer {
  render(
    req: IncomingMessage,
    res: ServerResponse,
    ssrEntryUrl: string,
    staticRoot: string
  ): Promise<boolean>
}

export class NodeSsrRenderer implements SsrRenderer {
  async render(
    req: IncomingMessage,
    res: ServerResponse,
    ssrEntryUrl: string,
    staticRoot: string
  ): Promise<boolean> {
    const method = req.method || "GET"
    if (method !== "GET" && method !== "HEAD") {
      return false
    }

    if (!acceptsHtml(req.headers.accept)) {
      return false
    }

    try {
      const ssrModule = await import(/* @vite-ignore */ ssrEntryUrl)
      if (typeof ssrModule.render !== "function") {
        return false
      }
      const { html } = await ssrModule.render()
      const indexPath = path.join(staticRoot, "index.html")
      const indexInfo = await stat(indexPath).catch(() => undefined)
      if (!indexInfo?.isFile()) {
        return false
      }
      const template = await readFile(indexPath, "utf-8")
      const final = template.replace("<!--ssr-outlet-->", html)
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
      if (method === "HEAD") {
        res.end()
        return true
      }
      res.end(final)
      return true
    } catch {
      return false
    }
  }
}

function acceptsHtml(accept: string | undefined): boolean {
  return typeof accept === "string" && accept.includes("text/html")
}
