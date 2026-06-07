import type { TodoEntity } from '../entity/todo'
import type { TodoStatsDto } from '../use-case/todo-use-case'

export interface TodoResponse {
  readonly id: number
  readonly title: string
  readonly completed: boolean
}

export interface TodoStatsResponse {
  readonly total: number
  readonly completed: number
  readonly open: number
}

export const TodoPresenter = {
  present: (entity: TodoEntity | null): TodoResponse => {
    if (entity) {
      return {
        id: entity.id,
        title: entity.title,
        completed: entity.completed,
      }
    }
    return { id: 0, title: 'Not found', completed: false }
  },

  presentMany: (entities: readonly TodoEntity[]): readonly TodoResponse[] =>
    entities.map(e => TodoPresenter.present(e)),

  presentStats: (stats: TodoStatsDto): TodoStatsResponse => stats,
}
