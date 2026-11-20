// Invented demo data for the home-cooked meals room. None of it was said by
// real people. Project content lives in projects/homeMeals.ts, not here.
import type { Message, QueueItem, Reaction } from '../state/types'
import { opening, seededLine } from './script'

export interface RoomSeed {
  messages: Message[]
  reactions: Record<string, Reaction[]>
  // Starting statements shown as already confirmed. Empty in the demo.
  confirmed: string[]
  queue: QueueItem[]
  scriptIndex: number
}

export interface SampleNote {
  written: string
  sections: { heading: string; caveat?: string; items: string[] }[]
}

const whoUsesIt = seededLine(0)
const firstStep = seededLine(1)
const whatNext = seededLine(2)

export const homeMealsSeed: RoomSeed = {
  messages: [
    {
      id: 'seed-1',
      authorId: 'assistant',
      at: '2026-11-12T09:10:00',
      lang: 'en',
      text: opening.en,
      translation: opening.tr,
      scripted: true,
    },
    {
      id: 'seed-2',
      authorId: 'elif',
      at: '2026-11-12T09:42:00',
      lang: 'tr',
      text: 'Merhaba. Kısaca şöyle: evde yemek yapan insanların yemeklerini komşularına satabilmesini istiyoruz.',
      translation:
        'Hello. In short: we would like people who cook at home to be able to sell their meals to their neighbours.',
    },
    {
      id: 'seed-3',
      authorId: 'assistant',
      at: '2026-11-12T10:05:00',
      lang: 'tr',
      text: whoUsesIt.tr,
      translation: whoUsesIt.en,
      scripted: true,
    },
    {
      id: 'seed-4',
      authorId: 'elif',
      at: '2026-11-12T10:31:00',
      lang: 'tr',
      text: 'Bence en çok yakında oturan, akşam yemek yapmaya vakti olmayan insanlar.',
      translation: 'I think mostly people who live nearby and have no time to cook in the evening.',
    },
    {
      id: 'seed-5',
      authorId: 'tom',
      at: '2026-11-12T13:15:00',
      lang: 'en',
      text: 'Agreed. I’d add that the cook decides what to make each day. We shouldn’t tell anyone what to cook.',
      translation:
        'Katılıyorum. Şunu da ekleyeyim: ne pişireceğine her gün yemek yapan kişi karar verir. Kimseye ne pişireceğini söylemememiz gerekir.',
    },
    {
      id: 'seed-6',
      authorId: 'elif',
      at: '2026-11-12T13:40:00',
      lang: 'tr',
      text: 'Evet, herkes kendi menüsünü kendisi belirlesin.',
      translation: 'Yes, let everyone set their own menu.',
    },
    {
      id: 'seed-7',
      authorId: 'assistant',
      at: '2026-11-12T14:02:00',
      lang: 'tr',
      text: firstStep.tr,
      translation: firstStep.en,
      scripted: true,
    },
    {
      id: 'seed-8',
      authorId: 'burak',
      at: '2026-11-13T09:05:00',
      lang: 'en',
      text: 'Thank you both. Hasan, when you join, I’d like to hear your first thoughts too.',
      translation: 'İkinize de teşekkürler. Hasan, katıldığınızda sizin ilk düşüncelerinizi de duymak isterim.',
    },
    {
      id: 'seed-9',
      authorId: 'elif',
      at: '2026-11-13T11:48:00',
      lang: 'tr',
      text: 'Bence yemekler bir gün önceden sipariş edilmeli, böylece kimse boşuna yemek pişirmez.',
      translation: 'I think meals should be ordered a day ahead, so nobody cooks food for nothing.',
    },
    // Tom answers the assistant's question last, so the queued reply follows his message.
    {
      id: 'seed-10',
      authorId: 'tom',
      at: '2026-11-13T14:20:00',
      lang: 'en',
      text: 'Back to the earlier question: a neighbour sees what is on offer and asks the cook for a portion. Then they agree a time to collect it.',
      translation:
        'Önceki soruya dönersem: komşu neler olduğunu görüyor ve yemek yapandan bir porsiyon istiyor. Sonra yemeğin alınacağı saati birlikte kararlaştırıyorlar.',
    },
  ],
  reactions: {
    'neighbours-buy': [
      { personId: 'elif', kind: 'right' },
      { personId: 'tom', kind: 'right' },
    ],
    'nearby-customers': [{ personId: 'elif', kind: 'right' }],
    'cook-chooses': [
      { personId: 'elif', kind: 'right' },
      { personId: 'tom', kind: 'right' },
    ],
    'order-ahead': [
      { personId: 'elif', kind: 'right' },
      {
        personId: 'tom',
        kind: 'notRight',
        correction: {
          lang: 'en',
          text: 'Not always a day ahead. Some cooks make extra and sell what is left.',
          translation: 'Her zaman bir gün önceden değil. Bazı yemek yapanlar fazladan pişirip kalanı satar.',
        },
      },
    ],
  },
  // Nothing starts as confirmed. Hasan has not joined, and only Burak confirms.
  confirmed: [],
  queue: [
    // The reply to Tom's message, the last in the thread.
    {
      id: 'seed-q1',
      kind: 'message',
      replyTo: 'tom',
      lang: 'en',
      text: whatNext.en,
      translation: whatNext.tr,
    },
    // The owners disagree, so it replaces the early interpretation with an open question
    // holding both views.
    {
      id: 'seed-q4',
      kind: 'statement',
      group: 'open',
      replaces: 'order-ahead',
      text: {
        en: 'Are meals always ordered a day ahead? Elif thinks they should be, so nobody cooks food for nothing; Tom says some cooks make extra and sell what is left.',
        tr: 'Yemekler her zaman bir gün önceden mi sipariş ediliyor? Elif öyle olması gerektiğini düşünüyor, böylece kimse boşuna yemek pişirmez; Tom ise bazı yemek yapanların fazladan pişirip kalanı sattığını söylüyor.',
      },
      source: {
        saidBy: 'elif',
        quote: 'Bence yemekler bir gün önceden sipariş edilmeli, böylece kimse boşuna yemek pişirmez.',
      },
    },
    // Records Tom's view of the handover. The step stays a question, because Elif has
    // not said how it works and Hasan has not joined.
    {
      id: 'seed-q3',
      kind: 'jobFlow',
      stepId: 'handover',
      who: {
        en: 'How does the meal reach the neighbour, and how do they pay?',
        tr: 'Yemek komşuya nasıl ulaşıyor, ödeme nasıl yapılıyor?',
      },
      what: {
        en: 'Tom says they agree a time and the neighbour collects it. Not agreed by all yet.',
        tr: 'Tom’a göre bir saat kararlaştırılıyor ve komşu yemeği gidip alıyor. Henüz herkes aynı fikirde değil.',
      },
      unknown: true,
      source: { saidBy: 'tom', quote: 'agree a time to collect it' },
    },
  ],
  scriptIndex: 3,
}

// A sample of what prompts/consultant-notes.md asks the assistant to write.
export const homeMealsNote: SampleNote = {
  written: '2026-11-13T15:00:00',
  sections: [
    {
      heading: 'What is confirmed',
      items: ['Nothing yet. No statement has been confirmed, and Hasan has not joined.'],
    },
    {
      heading: 'What is still interpretation',
      items: [
        'People who cook at home sell meals to their neighbours. Elif and Tom both marked it right.',
        'Each cook decides what to make. Elif and Tom both marked it right.',
        'Customers may mostly live nearby. Elif marked it right; Tom has not reacted.',
        'A few portions at a time, and starting with a few known cooks: nobody has reacted yet.',
      ],
    },
    {
      heading: 'Where the owners disagree',
      items: [
        'Ordering a day ahead. Elif marked it right and gave the reason that nobody cooks food for nothing. Tom marked it not right: some cooks make extra and sell what is left. The two may not conflict.',
      ],
    },
    {
      heading: 'What I would ask next',
      items: [
        'Does the neighbour always collect the meal, or does it sometimes come to them? So far only Tom has described it, and only the collecting.',
        'What happens if a cook cannot make a meal they offered?',
        'Who sets the price of a meal?',
        'How does the neighbour pay?',
        'Hasan, how do you see ordering ahead compared with selling what is left?',
      ],
    },
    {
      heading: 'What this may mean for the software',
      caveat: 'My reading, not the owners’ words.',
      items: [
        'Tom describes neighbours asking cooks directly, so each cook may need a simple way to say what is on offer today.',
        'Some meals are made to order and some are made extra, so an offer may need to say which kind it is.',
      ],
    },
  ],
}

export const seeds: Record<string, RoomSeed | undefined> = { 'home-meals': homeMealsSeed }
export const sampleNotes: Record<string, SampleNote | undefined> = { 'home-meals': homeMealsNote }

// The demo opens as Burak, on the list of projects.
export const startingViewer = 'burak'
