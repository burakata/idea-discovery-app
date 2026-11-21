// Text that exists only in the demo: the prototype's own controls and the
// simulated sign-in. Kept apart from en.ts and tr.ts so the api build leaves it
// out. Typed so a missing or extra key in either language fails the build.
import type { Lang } from '../languages'
import { useT } from './index'

const en = {
  preview: {
    label: 'Interactive preview',
    short: 'Preview',
    explain: 'The assistant and sharing are simulated. Everything stays in this browser.',
    viewAs: 'View as',
    notJoined: 'not joined yet',
    reset: 'Reset demo',
  },
  sample: {
    tag: 'Demo',
    tryTitle: 'Just looking around?',
    tryExplain: 'Open the demo as the sample consultant. Everything is invented and stays in this browser.',
    tryButton: 'Try the demo',
    noEmail: 'This is the demo: no email is sent, whatever you write here.',
    linkTitle: 'Sample sign-in link',
    linkExplain: 'In the real app this page opens from the emailed link. Here it is only a sample.',
  },
}

export type DemoStrings = typeof en

const tr: DemoStrings = {
  preview: {
    label: 'Etkileşimli önizleme',
    short: 'Önizleme',
    explain:
      'Yapay zekâ yardımcısı ve paylaşım gerçek değil, yalnızca nasıl çalışacağını gösterir. Her şey bu tarayıcıda kalır.',
    viewAs: 'Kimin gözünden',
    notJoined: 'henüz katılmadı',
    reset: 'Demoyu sıfırla',
  },
  sample: {
    tag: 'Demo',
    tryTitle: 'Sadece göz atıyor musunuz?',
    tryExplain: 'Demoyu örnek danışman olarak açın. Tüm bilgiler örnektir ve bu tarayıcıda kalır.',
    tryButton: 'Demoyu dene',
    noEmail: 'Burası demo: buraya ne yazarsanız yazın e-posta gönderilmez.',
    linkTitle: 'Örnek giriş bağlantısı',
    linkExplain: 'Gerçek uygulamada bu sayfa e-postadaki bağlantıdan açılır. Burada yalnızca bir örnektir.',
  },
}

const demoStrings: Record<Lang, DemoStrings> = { en, tr }

// English only: Burak's demo screens.
export const demoConsultant = {
  scriptDone: 'The scripted replies have run out. Use Reset demo to start again.',
  scripted: 'Scripted example',
  noteSample: 'Sample note',
  noteSimulated:
    'This note is a hand-written sample. In the real app the assistant writes a new one when you ask.',
}

export function useDemoT(): DemoStrings {
  return demoStrings[useT().lang]
}
