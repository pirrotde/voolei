// Server Actions - Executam no servidor, podem ser chamadas do cliente
// Substitui a necessidade do Express API
import { createServerFn } from '@tanstack/start/server'
import {
  createRoom,
  getRoomByCode,
  loadRoomState,
  saveRoomState,
  addMatchHistory
} from './db-volei'
import type { State } from './volei'

// Criar sala
export const createRoomAction = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    return await createRoom(data.name)
  })

// Entrar em sala por código
export const joinRoomAction = createServerFn({ method: 'POST' })
  .validator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    const roomId = await getRoomByCode(data.code)
    if (!roomId) {
      throw new Error('Sala não encontrada')
    }
    return { roomId }
  })

// Carregar estado da sala
export const loadStateAction = createServerFn({ method: 'GET' })
  .validator((data: { roomId: string }) => data)
  .handler(async ({ data }) => {
    return await loadRoomState(data.roomId)
  })

// Salvar estado da sala
export const saveStateAction = createServerFn({ method: 'POST' })
  .validator((data: { roomId: string; state: State }) => data)
  .handler(async ({ data }) => {
    await saveRoomState(data.roomId, data.state)
    return { success: true }
  })
