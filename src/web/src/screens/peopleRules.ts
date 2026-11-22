// Rules of Burak's People screen, apart from the screen so they can be tested.
import { fill } from '../strings'
import { consultant as c } from '../strings/consultant'
import type { CopyResult, Member, InviteOutcome, SignInSession } from '../state/context'

// The line shown after inviting: what happened, in plain words.
export function inviteMessage(outcome: InviteOutcome, email: string): { tone: 'info' | 'amber'; text: string } {
  switch (outcome.kind) {
    case 'invited':
      return { tone: 'info', text: fill(c.people.invitedTo, { email }) }
    case 'added':
      return { tone: 'info', text: fill(c.people.added, { name: outcome.displayName }) }
    case 'tryLater':
      return { tone: 'amber', text: c.people.tryLater }
  }
}

// A sign-in is live until it is ended or runs out.
export function isLive(session: SignInSession, now: Date): boolean {
  return session.endedAt === null && new Date(session.expiresAt) > now
}

// Burak is never removed, and he has no use for a link to his own account.
export function canRemove(member: Member, myId: string | undefined): boolean {
  return member.role !== 'consultant' && member.userId !== myId
}

export function canCopySignInLink(member: Member, myId: string | undefined): boolean {
  return canRemove(member, myId)
}

// What the page says after a copy that worked. The link itself is never in it.
export function copiedMessage(result: CopyResult, name: string): string | null {
  return result.copied ? fill(c.people.linkCopied, { name }) : null
}
