import type { TodoEntity } from '../entity/todo'

export interface TodoRepository {
  readonly getAll: () => readonly TodoEntity[]
  readonly create: (title: string) => TodoEntity
  readonly delete: (id: number) => TodoEntity | null
  readonly update: (id: number, title: string) => TodoEntity | null
  readonly toggle: (id: number) => TodoEntity | null
  readonly findById: (id: number) => TodoEntity | null
}
