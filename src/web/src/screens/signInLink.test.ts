import { afterEach, describe, expect, it } from 'vitest'
import { forgetSignInToken, startupSignInToken, takeSignInToken } from './signInLink'

function fakeBrowser(hash: string) {
  const location = { hash, pathname: '/idea/sign-in', search: '?x=1' }
  const history = {
    state: { idx: 3 },
    replaced: [] as string[],
    replaceState(_state: unknown, _unused: string, url: string) {
      this.replaced.push(url)
      location.hash = ''
    },
  }
  return { location, history }
}

afterEach(() => forgetSignInToken())

describe('reading the sign-in link', () => {
  it('takes the token from the fragment and clears the fragment at once', () => {
    const { location, history } = fakeBrowser('#t=abc-123_XYZ')
    expect(takeSignInToken(location, history)).toBe('abc-123_XYZ')
    expect(history.replaced).toEqual(['/idea/sign-in?x=1'])
    expect(location.hash).toBe('')
  })

  it('still has the token when the same page renders twice', () => {
    const { location, history } = fakeBrowser('#t=once')
    expect(takeSignInToken(location, history)).toBe('once')
    expect(takeSignInToken(location, history)).toBe('once')
  })

  it('forgets the token after it was used', () => {
    const { location, history } = fakeBrowser('#t=once')
    takeSignInToken(location, history)
    forgetSignInToken()
    expect(takeSignInToken(location, history)).toBeNull()
  })

  it('finds no token when there is no fragment, and clears nothing', () => {
    const { location, history } = fakeBrowser('')
    expect(takeSignInToken(location, history)).toBeNull()
    expect(history.replaced).toEqual([])
  })

  it('clears a fragment that holds no token', () => {
    const { location, history } = fakeBrowser('#other=1')
    expect(takeSignInToken(location, history)).toBeNull()
    expect(history.replaced).toHaveLength(1)
  })
})

describe('reading the link at startup', () => {
  it('takes the token and clears the fragment on the sign-in page, under a base path', () => {
    const { location, history } = fakeBrowser('#t=abc')
    location.pathname = '/idea-discovery-app/sign-in'
    startupSignInToken('/idea-discovery-app', location, history)
    expect(history.replaced).toEqual(['/idea-discovery-app/sign-in?x=1'])
    // The page then finds it without the fragment.
    expect(takeSignInToken({ hash: '', pathname: '/', search: '' }, history)).toBe('abc')
  })

  it('leaves every other address alone', () => {
    const { location, history } = fakeBrowser('#t=abc')
    location.pathname = '/'
    startupSignInToken('', location, history)
    expect(history.replaced).toEqual([])
    expect(location.hash).toBe('#t=abc')
  })
})
