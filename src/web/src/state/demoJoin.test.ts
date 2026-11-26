import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { projects } from '../projects'
import type { Clipboard } from './copyLink'
import * as join from './demoJoin'
import { createConsultantActions, createInitialState, reducer } from './demoStore'

const home = projects[0].id
const BASE = 'https://demo.test/app'

// The harness never re-renders, like a screen that reloads straight after an action.
function store(clipboard?: Clipboard) {
  const latest = { current: createInitialState() }
  const actions = createConsultantActions(latest, () => {}, () => clipboard, BASE, 'Mozilla/5.0 (iPhone) Safari/604.1')
  return { latest, actions }
}

async function refusal(run: () => Promise<unknown>): Promise<ApiError> {
  try {
    await run()
  } catch (failure) {
    if (failure instanceof ApiError) return failure
  }
  throw new Error('expected a refusal')
}

const asker = { name: 'Işıl Yıldız', email: 'isil@example.test' }

describe('the demo: switching asking on and off', () => {
  it('starts off, with the sample project\'s own demo code', async () => {
    const { latest, actions } = store()
    expect(await actions.joinAsking(home)).toBe(false)
    expect(await actions.joinCanAsk(join.defaultCode(home))).toBe(false)
    expect(join.codeOf(latest.current, home)).toBe(join.defaultCode(home))
  })

  it('turns on, copies the sample link, and the page opens with that code', async () => {
    const copied: string[] = []
    const { actions } = store({ writeText: async (text) => void copied.push(text) })
    const result = await actions.turnOnJoinLink(home)
    expect(result).toEqual({ copied: true })
    expect(copied).toEqual([`${BASE}/join/${join.defaultCode(home)}`])
    expect(await actions.joinAsking(home)).toBe(true)
    expect(await actions.joinCanAsk(join.defaultCode(home))).toBe(true)
  })

  it('answers an unknown code and a switched-off code the same', async () => {
    const { actions } = store()
    await actions.turnOnJoinLink(home)
    await actions.turnOffJoinLink(home)
    expect(await actions.joinCanAsk(join.defaultCode(home))).toBe(false)
    expect(await actions.joinCanAsk('nope')).toBe(false)
    const off = await refusal(() => actions.joinAsk(join.defaultCode(home), asker))
    const unknown = await refusal(() => actions.joinAsk('nope', asker))
    expect([off.status, off.code]).toEqual([unknown.status, unknown.code])
  })

  it('replaces the link: the old code stops, asking stays on, waiting requests stay', async () => {
    const { actions } = store()
    await actions.turnOnJoinLink(home)
    await actions.joinAsk(join.defaultCode(home), asker)
    await actions.renewJoinLink(home)
    expect(await actions.joinCanAsk(join.defaultCode(home))).toBe(false)
    expect(await actions.joinAsking(home)).toBe(true)
    expect(await actions.listJoinRequests(home)).toHaveLength(1)
  })

  it('keeps waiting requests when asking is switched off', async () => {
    const { actions } = store()
    await actions.turnOnJoinLink(home)
    await actions.joinAsk(join.defaultCode(home), asker)
    await actions.turnOffJoinLink(home)
    expect(await actions.listJoinRequests(home)).toHaveLength(1)
  })

  it('never lets a copied link into the saved state, and hands it back only when the clipboard fails', async () => {
    const { latest, actions } = store({ writeText: async () => { throw new Error('refused') } })
    const result = await actions.turnOnJoinLink(home)
    expect(result.copied).toBe(false)
    const link = (result as { link: string }).link
    expect(link).toBe(`${BASE}/join/${join.defaultCode(home)}`)
    expect(JSON.stringify(latest.current)).not.toContain(link)
    expect(JSON.stringify(latest.current)).not.toContain(BASE)
  })
})

describe('the demo: asking, waiting, and being approved', () => {
  async function asked() {
    const harness = store()
    await harness.actions.turnOnJoinLink(home)
    const status = await harness.actions.joinAsk(join.defaultCode(home), asker)
    return { ...harness, status }
  }

  it('reads back a waiting request straight after asking, with name, unchecked email and device', async () => {
    const { actions, status } = await asked()
    expect(status).toBe('pending')
    expect(await actions.joinStatus()).toBe('pending')
    const [request] = await actions.listJoinRequests(home)
    expect(request).toMatchObject({ name: 'Işıl Yıldız', uncheckedEmail: 'isil@example.test', nameMatchesMember: false })
    expect(request.device).toContain('iPhone')
  })

  it('asking twice from the same browser keeps one request', async () => {
    const { actions } = await asked()
    expect(await actions.joinAsk(join.defaultCode(home), asker)).toBe('pending')
    expect(await actions.listJoinRequests(home)).toHaveLength(1)
  })

  it('refuses a name the API would refuse', async () => {
    const { actions } = store()
    await actions.turnOnJoinLink(home)
    for (const name of ['', '   ', 'Ali <b>', 'x'.repeat(81), 'A1']) {
      expect((await refusal(() => actions.joinAsk(join.defaultCode(home), { name, email: '' }))).code).toBe(
        'invalid_request',
      )
    }
  })

  it('caps the waiting requests like the API', () => {
    let state = join.turnOn(createInitialState(), home)
    const now = new Date()
    for (let i = 0; i < 20; i++) {
      // Each request comes from a browser of its own: forget the cookie.
      state = { ...join.ask(state, join.defaultCode(home), { name: `Person ${String.fromCharCode(65 + i)}`, email: '' }, 'UA', now).state, myJoinRequest: null }
    }
    expect(() => join.ask(state, join.defaultCode(home), asker, 'UA', now)).toThrowError(
      expect.objectContaining({ status: 429, code: 'try_later' }),
    )
  })

  it('flags a name that matches a member, accents and the Turkish I aside, and no other', async () => {
    const { actions } = store()
    const member = (await actions.getProject(home)).members.find((entry) => entry.role === 'owner')!
    await actions.turnOnJoinLink(home)
    await actions.joinAsk(join.defaultCode(home), { name: member.displayName.toUpperCase(), email: '' })
    expect((await actions.listJoinRequests(home))[0].nameMatchesMember).toBe(true)
    expect(join.nameKey('Isil')).toBe(join.nameKey('Işıl'))
    expect(join.nameKey('Sukru')).toBe(join.nameKey('Şükrü'))
    expect(join.nameKey('Işıl')).not.toBe(join.nameKey('Can'))
  })

  it('approves: the person joins the members, with a corrected name, and the list reads back at once', async () => {
    const { actions } = await asked()
    const [request] = await actions.listJoinRequests(home)
    const name = await actions.approveJoinRequest(request.id, 'Işıl Y.')
    expect(name).toBe('Işıl Y.')
    expect(await actions.listJoinRequests(home)).toEqual([])
    const members = (await actions.getProject(home)).members
    expect(members.map((member) => member.displayName)).toContain('Işıl Y.')
    expect(members.find((member) => member.displayName === 'Işıl Y.')).toMatchObject({ role: 'owner', email: '' })
    expect(await actions.joinStatus()).toBe('approved')
  })

  it('approves with the typed name when none is corrected, and refuses a bad correction', async () => {
    const { actions } = await asked()
    const [request] = await actions.listJoinRequests(home)
    expect((await refusal(() => actions.approveJoinRequest(request.id, '1234'))).code).toBe('invalid_request')
    expect(await actions.listJoinRequests(home)).toHaveLength(1)
    expect(await actions.approveJoinRequest(request.id)).toBe('Işıl Yıldız')
  })

  it('rejects: the list empties and the person is told', async () => {
    const { actions } = await asked()
    const [request] = await actions.listJoinRequests(home)
    await actions.rejectJoinRequest(request.id)
    expect(await actions.listJoinRequests(home)).toEqual([])
    expect(await actions.joinStatus()).toBe('rejected')
    expect((await refusal(() => actions.rejectJoinRequest(request.id))).code).toBe('request_not_waiting')
  })

  it('answers a stranger\'s browser "expired", whatever happened to others', async () => {
    const { latest } = await asked()
    const other = { ...latest.current, myJoinRequest: null }
    expect(join.statusOf(other, new Date())).toBe('none')
  })

  it('shows a request only on the link it was made on', async () => {
    const { latest, actions } = await asked()
    const other = projects[1].id
    await actions.turnOnJoinLink(other)
    expect(await actions.joinStatus(join.defaultCode(home))).toBe('pending')
    expect(await actions.joinStatus(join.defaultCode(other))).toBe('none')
    expect(join.statusOf(latest.current, new Date(), 'nope')).toBe('none')
  })

  it('lets a request run out after 48 hours, for both sides', async () => {
    const { latest } = await asked()
    const later = new Date(Date.now() + 49 * 60 * 60 * 1000)
    expect(join.statusOf(latest.current, later)).toBe('expired')
    expect(join.listRequests(latest.current, home, later)).toEqual([])
  })
})

describe('the demo: continuing', () => {
  it('signs the demo in as the newly approved person, once', async () => {
    const { latest, actions } = store()
    await actions.turnOnJoinLink(home)
    await actions.joinAsk(join.defaultCode(home), asker)
    const [request] = await actions.listJoinRequests(home)
    await actions.approveJoinRequest(request.id)
    // Burak is the one signed in until the person continues.
    latest.current = { ...latest.current, signedIn: false, guestLanguage: 'tr' }
    await actions.joinContinue()

    const state = latest.current
    expect(state.signedIn).toBe(true)
    const viewer = state.people[state.viewAs]
    expect(viewer).toMatchObject({ name: 'Işıl Yıldız', role: 'owner', roomId: home, language: 'tr' })
    expect(await actions.joinStatus()).toBe('none')
    // Single use.
    expect((await refusal(() => actions.joinContinue())).code).toBe('cannot_claim')
  })

  it('refuses to continue while the request is only waiting, and after it was rejected', async () => {
    const { actions } = store()
    await actions.turnOnJoinLink(home)
    await actions.joinAsk(join.defaultCode(home), asker)
    expect((await refusal(() => actions.joinContinue())).code).toBe('cannot_claim')
    const [request] = await actions.listJoinRequests(home)
    await actions.rejectJoinRequest(request.id)
    expect((await refusal(() => actions.joinContinue())).code).toBe('cannot_claim')
  })

  it('refuses to continue after the approval window has passed', async () => {
    const { latest, actions } = store()
    await actions.turnOnJoinLink(home)
    await actions.joinAsk(join.defaultCode(home), asker)
    const [request] = await actions.listJoinRequests(home)
    await actions.approveJoinRequest(request.id)
    const later = new Date(Date.now() + 49 * 60 * 60 * 1000)
    expect(() => join.claim(latest.current, later)).toThrowError(expect.objectContaining({ code: 'cannot_claim' }))
  })

  it('still lets an approved person continue after asking was switched off', async () => {
    const { latest, actions } = store()
    await actions.turnOnJoinLink(home)
    await actions.joinAsk(join.defaultCode(home), asker)
    const [request] = await actions.listJoinRequests(home)
    await actions.approveJoinRequest(request.id)
    await actions.turnOffJoinLink(home)
    await actions.joinContinue()
    expect(latest.current.signedIn).toBe(true)
  })
})

describe('the demo: saved data', () => {
  it('has a new shape, so old saved data is dropped by the version', () => {
    const state = createInitialState()
    expect(state.version).toBeGreaterThanOrEqual(8)
    expect(Object.keys(state)).toEqual(expect.arrayContaining(['joinLinks', 'joinRequests', 'myJoinRequest']))
    // The reducer runs the same rules, so a replay lands in the same place.
    const on = reducer(state, { type: 'joinOn', projectId: home })
    expect(join.isAsking(on, home)).toBe(true)
  })
})
