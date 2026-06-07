export interface UserEntity {
  readonly id: number
  readonly name: string
  readonly email: string
}

export function createUserEntity(id: number, name: string, email: string): UserEntity {
  return { id, name, email }
}

export function updateUserEntity(user: UserEntity, name: string, email: string): UserEntity {
  return { ...user, name, email }
}
