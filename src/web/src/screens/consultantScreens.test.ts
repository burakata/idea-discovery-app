import { describe, expect, it } from 'vitest'
import { LANG_LABELS, LANGS, type Lang } from '../languages'
import type { Member, SignInSession } from '../state/context'
import { isEnglishOnly, screenLang } from '../strings'
import { consultant as c } from '../strings/consultant'
import { canCopySignInLink, canRemove, copiedMessage, deviceLabel, inviteMessage, isLive } from './peopleRules'
import { cleanDraft, emptyDraft, formGroups, PROJECT_LIMITS, validateDraft } from './projectFormRules'

// A language the app does not have yet: the form must grow a field pair for it.
const withThird = [...LANGS, 'de'] as unknown as readonly Lang[]

describe('the create form takes its fields from the languages', () => {
  it('has one group for each language in LANGS, named in that language', () => {
    expect(formGroups().map((group) => group.lang)).toEqual([...LANGS])
    expect(formGroups().map((group) => group.label)).toEqual(LANGS.map((lang) => LANG_LABELS[lang].full))
  })

  it('has a title and an introduction for each, and none for a language that is not listed', () => {
    const draft = emptyDraft()
    expect(Object.keys(draft.title)).toEqual([...LANGS])
    expect(Object.keys(draft.intro)).toEqual([...LANGS])
    expect(Object.keys(draft.title)).not.toContain('de')
  })

  it('requires every language: a missing one is an error, so none can be hard-coded away', () => {
    const filled = emptyDraft()
    for (const lang of LANGS) {
      filled.title[lang] = `title ${lang}`
      filled.intro[lang] = `intro ${lang}`
    }
    expect(validateDraft(filled)).toEqual({})
    for (const lang of LANGS) {
      const missing = { ...filled, title: { ...filled.title, [lang]: '  ' } }
      expect(validateDraft(missing)).toEqual({ [`title.${lang}`]: 'titleMissing' })
    }
  })

  it('grows a field pair when a language is added', () => {
    expect(Object.keys(emptyDraft(withThird).title)).toContain('de')
    const draft = cleanDraft(emptyDraft(withThird), withThird)
    expect(Object.keys(validateDraft(draft, withThird))).toEqual(
      expect.arrayContaining(['title.de', 'intro.de']),
    )
  })

  it('follows the API limits and trims what it sends', () => {
    const draft = emptyDraft()
    for (const lang of LANGS) {
      draft.title[lang] = 'x'.repeat(PROJECT_LIMITS.title)
      draft.intro[lang] = 'y'.repeat(PROJECT_LIMITS.intro)
    }
    expect(validateDraft(draft)).toEqual({})
    draft.title.en = 'x'.repeat(PROJECT_LIMITS.title + 1)
    draft.intro.tr = 'y'.repeat(PROJECT_LIMITS.intro + 1)
    expect(validateDraft(draft)).toEqual({ 'title.en': 'titleTooLong', 'intro.tr': 'introTooLong' })
    expect(cleanDraft({ title: { en: ' a ', tr: ' b ' }, intro: { en: ' c ', tr: ' d ' } }).title.en).toBe('a')
    expect(PROJECT_LIMITS).toEqual({ title: 120, intro: 2000 })
  })
})

describe('the invite outcome', () => {
  it('says each of the three plainly', () => {
    expect(inviteMessage({ kind: 'invited' }, 'a@x.test').text).toBe('Invitation email on its way to a@x.test.')
    expect(inviteMessage({ kind: 'added', displayName: 'Ayşe Demir' }, 'a@x.test').text).toBe(
      'Ayşe Demir already has an account and was added. A sign-in link is on its way.',
    )
    const later = inviteMessage({ kind: 'tryLater' }, 'a@x.test')
    expect(later.text).toBe(c.people.tryLater)
    expect(later.tone).toBe('amber')
  })
})

describe('who can be removed or sent a link', () => {
  const owner: Member = { userId: 'o', displayName: 'Elif', role: 'owner', email: 'e@x.test' }
  const burak: Member = { userId: 'b', displayName: 'Burak', role: 'consultant', email: 'b@x.test' }

  it('never offers Burak removal of himself', () => {
    expect(canRemove(owner, 'b')).toBe(true)
    expect(canRemove(burak, 'b')).toBe(false)
    // Even a consultant row that is not the signed-in person.
    expect(canRemove(burak, 'someone-else')).toBe(false)
    expect(canRemove({ ...owner, userId: 'b' }, 'b')).toBe(false)
  })

  it('offers a sign-in link for owners only', () => {
    expect(canCopySignInLink(owner, 'b')).toBe(true)
    expect(canCopySignInLink(burak, 'b')).toBe(false)
  })

  it('says a link was copied, naming the person, and never carries the link', () => {
    const text = copiedMessage({ copied: true }, 'Elif')
    expect(text).toBe(
      'Link copied. Anyone who opens it can sign in as Elif; share it only with them.',
    )
    expect(copiedMessage({ copied: false, link: 'https://x/#t=1' }, 'Elif')).toBeNull()
  })
})

describe('sign-ins', () => {
  const base: SignInSession = {
    id: 's',
    createdAt: '2026-11-01T00:00:00Z',
    lastSeenAt: null,
    expiresAt: '2026-12-01T00:00:00Z',
    endedAt: null,
    device: null,
  }
  const now = new Date('2026-11-22T00:00:00Z')

  it('is live until ended or expired', () => {
    expect(isLive(base, now)).toBe(true)
    expect(isLive({ ...base, endedAt: '2026-11-10T00:00:00Z' }, now)).toBe(false)
    expect(isLive({ ...base, expiresAt: '2026-11-10T00:00:00Z' }, now)).toBe(false)
  })
})

describe('the language of Burak\'s project screens', () => {
  it('is English for him, whatever his language setting', () => {
    for (const path of ['/projects/new', '/projects/abc/edit', '/projects/abc/people', '/projects/abc/people/']) {
      expect(isEnglishOnly(path, true)).toBe(true)
      expect(screenLang(path, 'tr', true)).toBe('en')
    }
  })

  it('is not English-only for anyone else, or on other pages', () => {
    expect(isEnglishOnly('/projects/new', false)).toBe(false)
    expect(isEnglishOnly('/projects/abc/other', true)).toBe(false)
  })
})

describe('readable devices', () => {
  const chromeWindows =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
  const safariIphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'

  it('gives a short browser-and-system label', () => {
    expect(deviceLabel(chromeWindows)).toBe('Chrome on Windows')
    expect(deviceLabel(safariIphone)).toBe('Safari on iPhone')
    expect(deviceLabel('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/132.0')).toBe('Firefox on Mac')
    expect(deviceLabel('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36')).toBe(
      'Chrome on Android',
    )
  })

  it('names Edge and Opera, which also say Chrome', () => {
    expect(deviceLabel(chromeWindows + ' Edg/130.0.0.0')).toBe('Edge on Windows')
    expect(deviceLabel(chromeWindows + ' OPR/115.0.0.0')).toBe('Opera on Windows')
  })

  it('falls back to "Unknown device" for nothing it knows', () => {
    expect(deviceLabel(null)).toBe('Unknown device')
    expect(deviceLabel('curl/8.0')).toBe('Unknown device')
    expect(deviceLabel('')).toBe('Unknown device')
  })
})
