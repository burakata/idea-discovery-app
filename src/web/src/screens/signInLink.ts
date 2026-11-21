// The sign-in link carries its one-time token in the address fragment
// (/sign-in#t=<token>), which the browser never sends to a server. The page takes
// the token out and clears the fragment at once, so it does not stay in the
// address bar, the history or a copied address. The token is used only when the
// person presses "Sign in"; it is kept in memory until then and never stored.
let pending: string | null = null

interface Where {
  hash: string
  pathname: string
  search: string
}

interface Replaceable {
  state: unknown
  replaceState: (state: unknown, unused: string, url: string) => void
}

export function takeSignInToken(
  location: Where = window.location,
  history: Replaceable = window.history,
): string | null {
  const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('t')
  // Whatever the fragment held, it goes. Reading it again after this finds nothing,
  // so the token stays in `pending` for a second render of the same page.
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search)
  if (token) pending = token
  return pending
}

export function forgetSignInToken(): void {
  pending = null
}
