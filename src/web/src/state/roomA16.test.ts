import { describe, expect, it } from 'vitest'
import { homeMeals } from '../projects/homeMeals'
import en from '../strings/en'
import tr from '../strings/tr'
import { createApiSession } from './apiSession'
import { createConsultantActions, createInitialState } from './demoStore'

// PRD A16 (future project): a gardening idea project shows no pallet-specific text and
// no sample-project text unless someone configured it. Nothing from one project becomes
// a default for another.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const garden = {
  title: { en: 'Community garden plots', tr: 'Topluluk bahçe parselleri' },
  intro: {
    en: 'Neighbours rent small garden plots by the season.',
    tr: 'Komşular küçük bahçe parsellerini sezonluk kiralar.',
  },
}

const members = [
  { userId: 'u-burak', displayName: 'Burak', role: 'consultant' },
  { userId: 'u-ayla', displayName: 'Ayla', role: 'owner' },
]
const conversations = [
  { number: 2, state: 'active', startedAt: '2026-11-20T10:00:00Z', finishedAt: null },
  { number: 1, state: 'finished', startedAt: '2026-11-10T10:00:00Z', finishedAt: '2026-11-19T10:00:00Z' },
]

async function gardenRoomFor(isConsultant: boolean) {
  const send = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/auth/csrf') return json({ token: 'T' })
    if (url === '/api/auth/me') {
      return json({ id: isConsultant ? 'u-burak' : 'u-ayla', displayName: 'X', uiLanguage: 'en', isConsultant })
    }
    if (url === '/api/projects') return json([{ id: 'g1', titleEn: garden.title.en, titleTr: garden.title.tr }])
    if (url === '/api/projects/g1') {
      return json({
        id: 'g1',
        titleEn: garden.title.en,
        titleTr: garden.title.tr,
        introEn: garden.intro.en,
        introTr: garden.intro.tr,
        status: 'active',
        createdAt: '2026-11-01T10:00:00Z',
        members,
      })
    }
    if (url === '/api/projects/g1/conversations') return json(conversations)
    return json({}, 404)
  }) as typeof fetch
  const session = createApiSession({ fetch: send, storage: { getItem: () => null, setItem: () => {} } })
  await session.start()
  return session.loadRoom('g1')
}

function stringsIn(value: unknown, found: string[] = []): string[] {
  if (typeof value === 'string') found.push(value)
  else if (value && typeof value === 'object') Object.values(value).forEach((inner) => stringsIn(inner, found))
  return found
}

const sampleTexts = [...new Set(stringsIn(homeMeals).filter((text) => text.length >= 12))]

function sampleTextIn(room: unknown): string[] {
  const dump = JSON.stringify(room)
  return sampleTexts.filter((text) => dump.includes(JSON.stringify(text).slice(1, -1)))
}

function expectEmptyContent(content: Record<string, unknown>) {
  expect(Object.keys(content).sort()).toEqual(
    ['jobFlow', 'openQuestions', 'similarBusinesses', 'statements', 'understanding'],
  )
  for (const list of Object.values(content)) expect(list).toEqual([])
}

describe('A16 the check itself', () => {
  it('finds home-meals text when a room is filled from homeMeals', () => {
    expect(sampleTexts.length).toBeGreaterThan(5)
    expect(sampleTextIn({ content: homeMeals })).toEqual(sampleTexts)
    expect(sampleTextIn({ title: garden.title })).toEqual([])
  })
})

describe('A16 the api room of a new project', () => {
  for (const [who, isConsultant] of [['an owner', false], ['the consultant', true]] as const) {
    it(`has its own title, introduction, people and conversations for ${who}`, async () => {
      const room = await gardenRoomFor(isConsultant)
      expect(room.id).toBe('g1')
      expect(room.title).toEqual(garden.title)
      expect(room.intro).toEqual(garden.intro)
      expect(room.members).toEqual(members)
      expect(room.conversations).toEqual(conversations)
    })

    it(`has every content list empty for ${who}`, async () => {
      expectEmptyContent((await gardenRoomFor(isConsultant)).content)
    })

    it(`carries no home-meals text for ${who}`, async () => {
      expect(sampleTextIn(await gardenRoomFor(isConsultant))).toEqual([])
    })

    it(`carries no pallet text for ${who}`, async () => {
      expect(JSON.stringify(await gardenRoomFor(isConsultant))).not.toMatch(/pallet|palet/i)
    })
  }
})

describe('A16 the demo room of a project Burak creates', () => {
  async function demoGardenRoom() {
    const latest = { current: createInitialState() }
    const actions = createConsultantActions(latest, () => {}, () => undefined)
    const id = await actions.createProject(garden)
    const { roomOf } = await import('./demoRoom')
    return roomOf(latest.current, id)
  }

  it('has its own title and introduction', async () => {
    const room = await demoGardenRoom()
    expect(room.title).toEqual(garden.title)
    expect(room.intro).toEqual(garden.intro)
  })

  it('has every content list empty', async () => {
    expectEmptyContent((await demoGardenRoom()).content)
  })

  it('carries no home-meals text', async () => {
    expect(sampleTextIn(await demoGardenRoom())).toEqual([])
  })

  it('carries no pallet text', async () => {
    expect(JSON.stringify(await demoGardenRoom())).not.toMatch(/pallet|palet/i)
  })
})

describe('A16 the idea-page strings', () => {
  it.each([
    ['English', en.idea],
    ['Turkish', tr.idea],
  ])('name no project in the %s text', (_language, idea) => {
    for (const text of stringsIn(idea)) expect(text).not.toMatch(/pallet|palet|meal|yemek|cook|aşçı|garden|bahçe/i)
  })
})
