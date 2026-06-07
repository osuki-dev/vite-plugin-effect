import type { UserRepository } from '../repository/user-repository'
import type { UserEntity } from '../entity/user'

export function createUserUseCase(repo: UserRepository) {
  return {
    getAll: (): readonly UserEntity[] => repo.getAll(),

    create: (name: string, email: string): UserEntity => {
      if (!name.trim()) throw new Error('Name is required')
      if (!email.trim()) throw new Error('Email is required')
      return repo.create(name.trim(), email.trim())
    },

    remove: (id: number): UserEntity | null => repo.delete(id),

    update: (id: number, name: string, email: string): UserEntity | null => {
      if (!name.trim()) throw new Error('Name is required')
      if (!email.trim()) throw new Error('Email is required')
      return repo.update(id, name.trim(), email.trim())
    },
  }
}

export type UserUseCase = ReturnType<typeof createUserUseCase>
