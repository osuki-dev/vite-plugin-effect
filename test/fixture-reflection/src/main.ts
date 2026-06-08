import { client } from "virtual:effect/client"

async function test() {
  const todos = await client.todos.getTodos()
  console.log("Todos:", todos)
}

test()
