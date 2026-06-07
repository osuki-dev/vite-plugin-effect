import { createUserEntity, updateUserEntity, type UserEntity } from '../entity/user'
import type { UserRepository } from './user-repository'

const users: UserEntity[] = [
  createUserEntity(1, 'Alice', 'alice@example.com'),
  createUserEntity(2, 'Bob', 'bob@example.com'),
]

let nextId = 3

export const InMemoryUserRepository: UserRepository = {
  getAll: () => users,

  create: (name: string, email: string) => {
    const user = createUserEntity(nextId++, name, email)
    users.push(user)
    return user
  },

  delete: (id: number) => {
    const index = users.findIndex(u => u.id === id)
    if (index === -1) return null
    const [deleted] = users.splice(index, 1)
    return deleted ?? null
  },

  update: (id: number, name: string, email: string) => {
    const user = users.find(u => u.id === id)
    if (!user) return null
    const updated = updateUserEntity(user, name, email)
    const index = users.findIndex(u => u.id === id)
    if (index !== -1) users[index] = updated
    return updated
  },

  findById: (id: number) => users.find(u => u.id === id) ?? null,
}
