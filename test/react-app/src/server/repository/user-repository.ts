import type { UserEntity } from '../entity/user'

export interface UserRepository {
  readonly getAll: () => readonly UserEntity[]
  readonly create: (name: string, email: string) => UserEntity
  readonly delete: (id: number) => UserEntity | null
  readonly update: (id: number, name: string, email: string) => UserEntity | null
  readonly findById: (id: number) => UserEntity | null
}
