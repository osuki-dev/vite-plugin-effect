import { createTodoEntity, toggleTodoEntity, updateTodoEntity, type TodoEntity } from '../entity/todo'
import type { TodoRepository } from './todo-repository'

const todos: TodoEntity[] = [
  createTodoEntity(1, 'Learn Effect', false),
  createTodoEntity(2, 'Build Fullstack App', false),
  createTodoEntity(3, 'HMR Works!', true),
]

let nextId = 4

export const InMemoryTodoRepository: TodoRepository = {
  getAll: () => todos,

  create: (title: string) => {
    const todo = createTodoEntity(nextId++, title, false)
    todos.push(todo)
    return todo
  },

  delete: (id: number) => {
    const index = todos.findIndex(t => t.id === id)
    if (index === -1) return null
    const [deleted] = todos.splice(index, 1)
    return deleted ?? null
  },

  update: (id: number, title: string) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return null
    const updated = updateTodoEntity(todo, title)
    const index = todos.findIndex(t => t.id === id)
    if (index !== -1) todos[index] = updated
    return updated
  },

  toggle: (id: number) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return null
    const updated = toggleTodoEntity(todo)
    const index = todos.findIndex(t => t.id === id)
    if (index !== -1) todos[index] = updated
    return updated
  },

  findById: (id: number) => todos.find(t => t.id === id) ?? null,
}
