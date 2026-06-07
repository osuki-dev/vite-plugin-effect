export interface TodoEntity {
  readonly id: number
  readonly title: string
  readonly completed: boolean
}

export function createTodoEntity(id: number, title: string, completed: boolean): TodoEntity {
  return { id, title, completed }
}

export function toggleTodoEntity(todo: TodoEntity): TodoEntity {
  return { ...todo, completed: !todo.completed }
}

export function updateTodoEntity(todo: TodoEntity, title: string): TodoEntity {
  return { ...todo, title }
}
