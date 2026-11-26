// Rules of the ask-to-join pages, apart from the screens so they can be tested.
import { consultant as c } from '../strings/consultant'
import { fill } from '../strings'
import type { CopyResult, JoinRequest, JoinState } from '../state/context'

// While a request waits, the page asks again this often (the brief: every 5 to 10 seconds).
export const POLL_MS = 7000

// What the page shows. "form" and "closed" are the only views before a request exists.
export type JoinView = 'form' | 'closed' | 'pending' | 'approved' | 'rejected' | 'expired'

// What a returning browser sees. A request this browser holds wins over everything,
// because it is the person's own: an approval can still be claimed after asking was
// switched off. With no request ("expired" is also what the API says then) the form
// shows only if asking is open. An unknown code and a switched-off project give the
// same answer, so they land on the same view.
export function entryView(status: JoinState, canAsk: boolean): JoinView {
  if (status === 'pending' || status === 'approved' || status === 'rejected') return status
  return canAsk ? 'form' : 'closed'
}

// Only a waiting request is worth asking about, and only while the page is on screen.
// Every other state is final: nothing will change it from this page.
export function shouldPoll(view: JoinView | 'loading', visible: boolean): boolean {
  return view === 'pending' && visible
}

// Burak's list: the warning shows only when the server flagged the name.
export function nameWarning(request: JoinRequest): string | null {
  return request.nameMatchesMember ? c.people.asking.sameName : null
}

export function emailLine(request: JoinRequest): string {
  return request.uncheckedEmail
    ? fill(c.people.asking.uncheckedEmail, { email: request.uncheckedEmail })
    : c.people.asking.noEmail
}

// What Burak is told after a copy that worked. The link itself is never in it.
export function joinCopiedMessage(result: CopyResult): string | null {
  return result.copied ? c.people.asking.linkCopied : null
}
