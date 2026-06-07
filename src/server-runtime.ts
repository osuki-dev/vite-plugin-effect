import type { IncomingMessage, ServerResponse } from "node:http"
import { rewriteRequestUrl } from "./mounts"
import type { ResolvedClientEntry } from "./options"
import type { LoadedApi } from "./server-api"
export { loadServerApi } from "./server-api"

// ---------------------------------------------------------------------------
// Request dispatch
// ---------------------------------------------------------------------------

export const handleApiRequest = async (
  apiValue: LoadedApi,
  entry: ResolvedClientEntry,
  req: IncomingMessage,
  res: ServerResponse
): Promise<Response> => {
  if (apiValue.type === "node") {
    await (apiValue.handler as any)(req, res)
    return new Response()
  }

  const webRequest = await nodeRequestToWebRequest(req, (url) => rewriteRequestUrl(entry, url))
  const response = await (apiValue.handler as (request: Request) => Promise<Response>)(webRequest)
  await webResponseToNodeResponse(response, res)
  return response
}

// ---------------------------------------------------------------------------
// Node.js ↔ Web Request adapter utilities
// ---------------------------------------------------------------------------

export const sendJson = (
  res: ServerResponse,
  status: number,
  body: unknown
) => {
  res.writeHead(status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(body))
}

export const nodeRequestToWebRequest = async (
  req: IncomingMessage,
  urlRewriter: (url: URL) => void
): Promise<Request> => {
  const url = new URL(req.url || "/", "http://" + (req.headers.host || "localhost"))

  urlRewriter(url)

  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item))
    } else {
      headers.append(key, value)
    }
  }

  let body: Buffer | undefined
  if (req.method !== "GET" && req.method !== "HEAD") {
    const chunks: Array<Buffer> = []
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }
    if (chunks.length > 0) {
      body = Buffer.concat(chunks)
    }
  }

  return new Request(url.toString(), {
    method: req.method,
    headers,
    body,
  })
}

export const webResponseToNodeResponse = async (
  response: Response,
  res: ServerResponse
) => {
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()))
  if (!response.body) {
    res.end()
    return
  }
  const body = Buffer.from(await response.arrayBuffer())
  res.end(body)
}
