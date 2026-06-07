import type { TodoRepository } from '../repository/todo-repository'
import type { TodoEntity } from '../entity/todo'

export interface TodoStatsDto {
  readonly total: number
  readonly completed: number
  readonly open: number
}

export function createTodoUseCase(repo: TodoRepository) {
  return {
    getAll: (): readonly TodoEntity[] => repo.getAll(),

    create: (title: string): TodoEntity => {
      if (!title.trim()) throw new Error('Title is required')
      return repo.create(title.trim())
    },

    remove: (id: number): TodoEntity | null => repo.delete(id),

    update: (id: number, title: string): TodoEntity | null => {
      if (!title.trim()) throw new Error('Title is required')
      return repo.update(id, title.trim())
    },

    toggle: (id: number): TodoEntity | null => repo.toggle(id),

    getStats: (): TodoStatsDto => {
      const all = repo.getAll()
      return {
        total: all.length,
        completed: all.filter(t => t.completed).length,
        open: all.filter(t => !t.completed).length,
      }
    },
  }
}

export type TodoUseCase = ReturnType<typeof createTodoUseCase>
