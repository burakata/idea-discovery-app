import { describe, expect, it } from 'vitest'
import * as roomRules from './roomRules'
import { createApiSession } from './apiSession'
import type { Room } from './context'

// PRD A02 (variable participation): a project has 1, 3 or 8 owners. No hardcoded owner
// count; appropriate permissions. Also R05 (only the consultant finishes and starts) and
// section 4.4 (finished conversations stay readable but cannot be written to).

type Role = 'consultant' | 'owner'
type Row = { userId: string; name: string; role: Role }
type Controls = { canWrite: boolean; canFinish: boolean; canStart: boolean }

// The contract under test. Read through the namespace so that a missing function fails
// its own tests, not the whole file, while the loadRoom tests stay runnable.
const rules = roomRules as unknown as {
  participantRows: (room: Room) => Row[]
  conversationControls: (viewer: { isConsultant: boolean }, room: Room, shownNumber: number) => Controls
}
const participantRows = (room: Room) => rules.participantRows(room)
const conversationControls = (viewer: { isConsultant: boolean }, room: Room, shownNumber: number) =>
  rules.conversationControls(viewer, room, shownNumber)

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

type Member = { userId: string; displayName: string; role: Role }
type Conversation = { number: number; state: 'active' | 'finished'; startedAt: string; finishedAt: string | null }

const active = (number: number): Conversation => ({
  number,
  state: 'active',
  startedAt: '2026-11-20T10:00:00Z',
  finishedAt: null,
})
const finished = (number: number): Conversation => ({
  number,
  state: 'finished',
  startedAt: '2026-11-10T10:00:00Z',
  finishedAt: '2026-11-19T10:00:00Z',
})

const ownerNames = ['Ayla', 'Deniz', 'Mert', 'Selin', 'Kerem', 'Nehir', 'Deniz', 'Oya']

function membersWith(ownerCount: number): Member[] {
  const owners = ownerNames.slice(0, ownerCount).map((displayName, index) => ({
    userId: `u-owner-${index + 1}`,
    displayName,
    role: 'owner' as const,
  }))
  // The consultant is listed in the middle on purpose: consultant rows must still come first.
  const consultant = { userId: 'u-consultant', displayName: 'Consultant Cem', role: 'consultant' as const }
  return [...owners.slice(0, 1), consultant, ...owners.slice(1)]
}

async function loadRoom(members: Member[], conversations: Conversation[], isConsultant = false): Promise<Room> {
  const send = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/auth/csrf') return json({ token: 'T' })
    if (url === '/api/auth/me') {
      return json({ id: 'u-viewer', displayName: 'X', uiLanguage: 'en', isConsultant })
    }
    if (url === '/api/projects') return json([{ id: 'p1', titleEn: 'Bike repair', titleTr: 'Bisiklet tamiri' }])
    if (url === '/api/projects/p1') {
      return json({
        id: 'p1',
        titleEn: 'Bike repair',
        titleTr: 'Bisiklet tamiri',
        introEn: 'Repairs at your door.',
        introTr: 'Kapınızda tamir.',
        status: 'active',
        createdAt: '2026-11-01T10:00:00Z',
        members,
      })
    }
    if (url === '/api/projects/p1/conversations') return json(conversations)
    return json({}, 404)
  }) as typeof fetch
  const session = createApiSession({ fetch: send, storage: { getItem: () => null, setItem: () => {} } })
  await session.start()
  return session.loadRoom('p1')
}

const owner = { isConsultant: false }
const consultant = { isConsultant: true }

describe.each([1, 3, 8])('A02 a project with %i owner(s)', (ownerCount) => {
  const members = membersWith(ownerCount)

  it('loads every member with the role the API gave', async () => {
    const room = await loadRoom(members, [active(1)])
    expect(room.members).toHaveLength(1 + ownerCount)
    expect(room.members).toEqual(members)
    expect(room.members.filter((m) => m.role === 'owner')).toHaveLength(ownerCount)
    expect(room.members.filter((m) => m.role === 'consultant')).toHaveLength(1)
  })

  it('lists one participant row per member, consultant first, none dropped or merged', async () => {
    const room = await loadRoom(members, [active(1)])
    const rows = participantRows(room)
    expect(rows).toHaveLength(1 + ownerCount)
    expect(rows[0]).toEqual({ userId: 'u-consultant', name: 'Consultant Cem', role: 'consultant' })
    expect(rows.slice(1).map((row) => row.userId)).toEqual(
      members.filter((m) => m.role === 'owner').map((m) => m.userId),
    )
    expect(rows.slice(1).map((row) => row.name)).toEqual(ownerNames.slice(0, ownerCount))
    expect(rows.slice(1).every((row) => row.role === 'owner')).toBe(true)
  })

  it('lets an owner write in the active conversation but not finish or start', async () => {
    const room = await loadRoom(members, [active(1)])
    expect(conversationControls(owner, room, 1)).toEqual({ canWrite: true, canFinish: false, canStart: false })
  })

  it('lets the consultant write and finish the active conversation but not start another', async () => {
    const room = await loadRoom(members, [active(1)], true)
    expect(conversationControls(consultant, room, 1)).toEqual({ canWrite: true, canFinish: true, canStart: false })
  })

  it('lets nobody write when the only conversation is finished; the consultant can start', async () => {
    const room = await loadRoom(members, [finished(1)])
    expect(conversationControls(owner, room, 1)).toEqual({ canWrite: false, canFinish: false, canStart: false })
    expect(conversationControls(consultant, room, 1)).toEqual({ canWrite: false, canFinish: false, canStart: true })
  })

  it('lets nobody write in an older finished conversation while a newer one is active', async () => {
    const room = await loadRoom(members, [finished(1), active(2)])
    expect(conversationControls(owner, room, 1)).toEqual({ canWrite: false, canFinish: false, canStart: false })
    expect(conversationControls(consultant, room, 1)).toEqual({ canWrite: false, canFinish: false, canStart: false })
  })

  it('lets nobody write or finish a conversation that does not exist', async () => {
    const room = await loadRoom(members, [finished(1), active(2)])
    for (const viewer of [owner, consultant]) {
      const controls = conversationControls(viewer, room, 7)
      expect(controls.canWrite).toBe(false)
      expect(controls.canFinish).toBe(false)
    }
  })
})

describe('A02 a room with no conversation yet', () => {
  it('lets the consultant start one and nobody write', async () => {
    const room = await loadRoom(membersWith(3), [], true)
    expect(conversationControls(consultant, room, 1)).toEqual({ canWrite: false, canFinish: false, canStart: true })
    expect(conversationControls(owner, room, 1)).toEqual({ canWrite: false, canFinish: false, canStart: false })
  })
})
