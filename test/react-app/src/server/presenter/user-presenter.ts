import type { UserEntity } from '../entity/user'

export interface UserResponse {
  readonly id: number
  readonly name: string
  readonly email: string
}

export const UserPresenter = {
  present: (entity: UserEntity | null): UserResponse => {
    if (entity) {
      return {
        id: entity.id,
        name: entity.name,
        email: entity.email,
      }
    }
    return { id: 0, name: 'Not found', email: '' }
  },

  presentMany: (entities: readonly UserEntity[]): readonly UserResponse[] =>
    entities.map(e => UserPresenter.present(e)),
}
