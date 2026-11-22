import type { CopyResult } from './context'

export type Clipboard = Pick<globalThis.Clipboard, 'writeText'>

// A link signs in whoever opens it. It goes from the server to the clipboard and
// nowhere else: not into React state, the store or storage. The link is held in
// this function's variables only, for the length of the call.
//
// If the clipboard is missing or refuses, the link is returned once so the open
// dialog can show it; that dialog is the only place it is ever held.
export async function copyLink(fetchLink: () => Promise<string>, clipboard: Clipboard | undefined): Promise<CopyResult> {
  const link = await fetchLink()
  try {
    if (!clipboard) throw new Error('no clipboard')
    await clipboard.writeText(link)
    return { copied: true }
  } catch {
    return { copied: false, link }
  }
}

// The browser's clipboard, read when needed so tests and old browsers can lack it.
export function browserClipboard(): Clipboard | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.clipboard
}
