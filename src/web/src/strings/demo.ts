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
    reset: 'Reset demo',
  },
  // The scripted assistant in the discussion, and what it simulates.
  discussion: {
    scripted: 'Scripted example',
    simulatedTitle: 'Replies here are examples',
    simulatedBody:
      'The assistant’s replies are scripted, not written by AI. Messages stay in this browser and are not shared.',
  },
  sample: {
    tag: 'Demo',
    tryTitle: 'Just looking around?',
    tryExplain: 'Open the demo as the sample consultant. Everything is invented and stays in this browser.',
    tryButton: 'Try the demo',
    noEmail: 'This is the demo: no email is sent, whatever you write here.',
    linkTitle: 'Sample sign-in link',
    linkExplain: 'In the real app this page opens from the emailed link. Here it is only a sample.',
    joinNote:
      'This is the demo: your request stays in this browser. To answer it, switch to the sample consultant under View as, or sign in as the consultant on the home page.',
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
    reset: 'Demoyu sıfırla',
  },
  discussion: {
    scripted: 'Örnek yanıt',
    simulatedTitle: 'Buradaki yanıtlar örnektir',
    simulatedBody:
      'Yardımcının yanıtları önceden yazılmıştır, yapay zekâ yazmıyor. Mesajlar bu tarayıcıda kalır, kimseyle paylaşılmaz.',
  },
  sample: {
    tag: 'Demo',
    tryTitle: 'Sadece göz atıyor musunuz?',
    tryExplain: 'Demoyu örnek danışman olarak açın. Tüm bilgiler örnektir ve bu tarayıcıda kalır.',
    tryButton: 'Demoyu dene',
    noEmail: 'Burası demo: buraya ne yazarsanız yazın e-posta gönderilmez.',
    linkTitle: 'Örnek giriş bağlantısı',
    linkExplain: 'Gerçek uygulamada bu sayfa e-postadaki bağlantıdan açılır. Burada yalnızca bir örnektir.',
    joinNote:
      'Burası demo: isteğiniz bu tarayıcıda kalır. Yanıtlamak için Kimin gözünden bölümünden örnek danışmana geçin ya da ana sayfadan danışman olarak girin.',
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

// Burak's Edit project screen in the demo.
export const demoProjectForm = {
  imageNote: 'This is the demo: the image stays in this browser, and it can be up to 1 MB.',
}

// Burak's people screen in the demo: what it simulates, in plain words.
export const demoPeople = {
  note: 'This is the demo: no email is sent, the links are samples that open nothing, and the sign-ins are invented.',
  sampleLink: 'This is a sample link: it opens nothing and signs nobody in.',
  joinLink: 'This is a sample link: it opens the demo’s ask-to-join page in this browser only.',
}

export function useDemoT(): DemoStrings {
  return demoStrings[useT().lang]
}
