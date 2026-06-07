import { InMemoryTodoRepository } from './repository/in-memory-todo-repository'
import { InMemoryUserRepository } from './repository/in-memory-user-repository'
import { createTodoUseCase } from './use-case/todo-use-case'
import { createUserUseCase } from './use-case/user-use-case'

export const todoRepository = InMemoryTodoRepository
export const userRepository = InMemoryUserRepository
export const todoUseCase = createTodoUseCase(todoRepository)
export const userUseCase = createUserUseCase(userRepository)
