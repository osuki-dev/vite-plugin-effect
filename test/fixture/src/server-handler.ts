export const handler = async (req, res) => {
  const url = req.url || "/"

  if (url === "/api/todos" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify([{ id: 1, title: "Learn Effect", completed: false }]))
    return
  }

  if (url === "/api/todos" && req.method === "POST") {
    let body = ""
    req.on("data", (chunk) => {
      body += chunk
    })
    req.on("end", () => {
      const payload = JSON.parse(body)
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ id: 2, title: payload.title, completed: false }))
    })
    return
  }

  res.writeHead(404)
  res.end("Not Found")
}
