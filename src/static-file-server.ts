import { createReadStream } from "node:fs"
import { readFile, stat } from "node:fs/promises"
import type { IncomingMessage, ServerResponse } from "node:http"
import * as path from "node:path"
import type { AddressInfo } from "node:net"

// ---------------------------------------------------------------------------
// StaticFileServer
// ---------------------------------------------------------------------------

export interface StaticFileServer {
  serve(
    req: IncomingMessage,
    res: ServerResponse,
    staticRoot: string,
    spaFallback: boolean
  ): Promise<void>
}

export class NodeStaticFileServer implements StaticFileServer {
  async serve(
    req: IncomingMessage,
    res: ServerResponse,
    staticRoot: string,
    spaFallback: boolean
  ): Promise<void> {
    const method = req.method || "GET"
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { "Allow": "GET, HEAD" })
      res.end()
      return
    }

    const url = new URL(req.url || "/", "http://localhost")
    const pathname = decodePathname(url.pathname)
    if (pathname === undefined) {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("Bad Request")
      return
    }

    const resolvedPath = path.resolve(staticRoot, "." + pathname)
    if (!isInside(staticRoot, resolvedPath)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("Forbidden")
      return
    }

    const filePath = await resolveStaticFile(resolvedPath, staticRoot, spaFallback, req)
    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
      res.end("Not Found")
      return
    }

    await sendFile(filePath, req, res, staticRoot)
  }
}

function decodePathname(pathname: string): string | undefined {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return undefined
  }
}

async function resolveStaticFile(
  candidate: string,
  staticRoot: string,
  spaFallback: boolean,
  req: IncomingMessage
): Promise<string | undefined> {
  const info = await stat(candidate).catch(() => undefined)
  if (info?.isFile()) return candidate
  if (info?.isDirectory()) {
    const indexPath = path.join(candidate, "index.html")
    const indexInfo = await stat(indexPath).catch(() => undefined)
    if (indexInfo?.isFile()) return indexPath
  }

  if (spaFallback && acceptsHtml(req.headers.accept)) {
    const indexPath = path.join(staticRoot, "index.html")
    const indexInfo = await stat(indexPath).catch(() => undefined)
    if (indexInfo?.isFile()) return indexPath
  }

  return undefined
}

async function sendFile(filePath: string, req: IncomingMessage, res: ServerResponse, staticRoot: string) {
  const info = await stat(filePath)
  res.writeHead(200, {
    "Content-Type": contentType(filePath),
    "Content-Length": String(info.size),
    "Cache-Control": cacheControl(filePath, staticRoot),
  })

  if (req.method === "HEAD") {
    res.end()
    return
  }

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.on("error", reject)
    res.on("finish", resolve)
    stream.pipe(res)
  })
}

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return !relative.startsWith("..") && !path.isAbsolute(relative)
}

function acceptsHtml(accept: string | undefined): boolean {
  return typeof accept === "string" && accept.includes("text/html")
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath).slice(1).toLowerCase()
  return mimeTypes[extension] || "application/octet-stream"
}

function cacheControl(filePath: string, staticRoot: string): string {
  return path.relative(staticRoot, filePath).startsWith("assets" + path.sep)
    ? "public, max-age=31536000, immutable"
    : "no-cache"
}

export function formatAddress(address: AddressInfo | string | null): string {
  if (!address || typeof address === "string") return String(address)
  const hostname = address.address === "0.0.0.0" || address.address === "::" ? "localhost" : address.address
  return "http://" + hostname + ":" + address.port
}

const mimeTypes: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  svg: "image/svg+xml; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
}
