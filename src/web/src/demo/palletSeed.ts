// Invented demo data for the pallet room. None of it was said by the real
// owners. Project content lives in projects/pallet.ts, not here.
import type { Message, QueueItem, Reaction } from '../state/types'
import { opening, seededLine } from './script'

export interface RoomSeed {
  messages: Message[]
  reactions: Record<string, Reaction[]>
  // Starting statements shown as already confirmed. Empty in the pallet demo.
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

export const palletSeed: RoomSeed = {
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
      authorId: 'selin',
      at: '2026-11-12T09:42:00',
      lang: 'tr',
      text: 'Merhaba. Kısaca şöyle: hazırlanmış paletleri bir depodan ya da işletmeden alıp başka bir depoya ya da işletmeye götürmek istiyoruz.',
      translation:
        'Hello. In short: we want to collect prepared pallets from one warehouse or business and take them to another warehouse or business.',
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
      authorId: 'selin',
      at: '2026-11-12T10:31:00',
      lang: 'tr',
      text: 'Bence mallarını şu an kendi kamyonu ve elemanıyla dağıtan tedarikçiler. Bu iş onlara pahalıya geliyor.',
      translation:
        'I think suppliers who currently deliver their goods with their own truck and staff. It costs them a lot.',
    },
    {
      id: 'seed-5',
      authorId: 'david',
      at: '2026-11-12T13:15:00',
      lang: 'en',
      text: 'Agreed. I’d add that the driver only moves the pallet. Packing is the sender’s job, not ours.',
      translation:
        'Katılıyorum. Şunu da ekleyeyim: şoför yalnızca paleti taşır. Paketleme gönderenin işi, bizim değil.',
    },
    {
      id: 'seed-6',
      authorId: 'selin',
      at: '2026-11-12T13:40:00',
      lang: 'tr',
      text: 'Evet, şoför mala dokunmaz. Palet sarılı ve hazır olmalı.',
      translation: 'Yes, the driver does not touch the goods. The pallet has to be wrapped and ready.',
    },
    {
      id: 'seed-7',
      authorId: 'assistant',
      at: '2026-11-12T14:02:00',
      lang: 'en',
      text: firstStep.en,
      translation: firstStep.tr,
      scripted: true,
    },
    {
      id: 'seed-8',
      authorId: 'burak',
      at: '2026-11-13T09:05:00',
      lang: 'en',
      text: 'Thank you both. Murat, when you join, I’d like to hear how you see waiting time at the warehouse.',
      translation:
        'İkinize de teşekkürler. Murat, katıldığınızda depodaki bekleme süresi hakkında ne düşündüğünüzü duymak isterim.',
    },
    {
      id: 'seed-9',
      authorId: 'selin',
      at: '2026-11-13T11:48:00',
      lang: 'tr',
      text: 'Beklemeye gelince: şoför yarım saatten fazla beklerse ek ücret almalıyız diye düşünüyorum.',
      translation: 'On waiting: if the driver waits more than half an hour, I think we should charge extra.',
    },
    // David answers the assistant's question last, so the queued reply follows his message.
    {
      id: 'seed-10',
      authorId: 'david',
      at: '2026-11-13T14:20:00',
      lang: 'en',
      text: 'Back to the earlier question: they ring the office and we agree a day and a time for collection.',
      translation:
        'Önceki soruya dönersem: ofisi arıyorlar; paletin alınacağı gün ve saati birlikte kararlaştırıyoruz.',
    },
  ],
  reactions: {
    'pallets-between': [
      { personId: 'selin', kind: 'right' },
      { personId: 'david', kind: 'right' },
    ],
    'driver-no-packing': [
      { personId: 'selin', kind: 'right' },
      { personId: 'david', kind: 'right' },
    ],
    'loading-unloading': [
      { personId: 'selin', kind: 'right' },
      {
        personId: 'david',
        kind: 'notRight',
        correction: {
          lang: 'en',
          text: 'Unloading depends on the site. Where there is no forklift, the driver helps.',
          translation: 'Boşaltma yere göre değişir. Forklift olmayan yerde şoför yardım eder.',
        },
      },
    ],
    'waiting-charges': [{ personId: 'selin', kind: 'right' }],
  },
  // Nothing starts as confirmed. Murat has not joined, and only Burak confirms.
  confirmed: [],
  queue: [
    // The reply to David's message, the last in the thread. Selin's message
    // answers Burak's question, so the assistant stayed quiet there.
    {
      id: 'seed-q1',
      kind: 'message',
      replyTo: 'david',
      lang: 'en',
      text: whatNext.en,
      translation: whatNext.tr,
    },
    // Closes the open question "Who asks for a job, and how?": the answer becomes an
    // early interpretation. One fact; "booked by appointment" is already a statement.
    {
      id: 'seed-q2',
      kind: 'statement',
      group: 'early',
      replaces: 'who-asks',
      text: {
        en: 'The customer asks for a job by phoning the office.',
        tr: 'Müşteri işi, ofisi arayarak ister.',
      },
      source: { saidBy: 'david', quote: 'they ring the office' },
    },
    // Rewords the existing statement about waiting time instead of repeating it.
    {
      id: 'seed-q3',
      kind: 'statement',
      group: 'early',
      replaces: 'waiting-charges',
      text: {
        en: 'If the driver waits more than half an hour, there may be an extra charge.',
        tr: 'Şoför yarım saatten fazla beklerse ek ücret alınabilir.',
      },
      source: { saidBy: 'selin', quote: 'şoför yarım saatten fazla beklerse ek ücret almalıyız diye düşünüyorum' },
    },
    // The owners disagree, so it becomes an open question with both views.
    {
      id: 'seed-q4',
      kind: 'statement',
      group: 'open',
      text: {
        en: 'Does the driver help with unloading? Selin agreed it “may not be part of the driver’s role”; David says the driver helps where the site has no forklift.',
        tr: 'Şoför boşaltmaya yardım ediyor mu? Selin bunun “şoförün işi olmayabileceğini” doğru buldu; David ise forklift olmayan yerde şoförün yardım ettiğini söylüyor.',
      },
      source: {
        saidBy: 'david',
        quote: 'Unloading depends on the site. Where there is no forklift, the driver helps.',
      },
    },
    // Fills in only the part David described. How the job reaches a driver stays a question.
    {
      id: 'seed-q5',
      kind: 'jobFlow',
      stepId: 'request',
      who: { en: 'Customer and office', tr: 'Müşteri ve ofis' },
      what: {
        en: 'The customer phones the office. A day and time for collection are agreed.',
        tr: 'Müşteri ofisi arar. Paletin alınacağı gün ve saat kararlaştırılır.',
      },
      stillUnknown: {
        who: { en: 'How does the job reach a driver?', tr: 'İş şoföre nasıl ulaşıyor?' },
        what: { en: 'Nobody has said yet.', tr: 'Henüz kimse söylemedi.' },
      },
      source: { saidBy: 'david', quote: 'they ring the office and we agree a day and a time for collection' },
    },
  ],
  scriptIndex: 3,
}

// A sample of what prompts/consultant-notes.md asks the assistant to write.
export const palletNote: SampleNote = {
  written: '2026-11-13T12:30:00',
  sections: [
    {
      heading: 'What is confirmed',
      items: ['Nothing yet. No statement has been confirmed, and Murat has not joined.'],
    },
    {
      heading: 'What is still interpretation',
      items: [
        'The driver is not expected to pack the goods. Selin and David both said so in the discussion and marked it right.',
        'Prepared pallets are moved from one warehouse or business to another. Selin and David marked it right.',
        'There may be extra charges for waiting time. Selin marked it right and mentioned half an hour as the limit.',
        'Booking by appointment, suppliers as customers, and starting with their own van: nobody has reacted yet.',
      ],
    },
    {
      heading: 'Where the owners disagree',
      items: [
        'Loading and unloading. Selin marked “may not be part of the driver’s role” as right. David marked it not right: where the receiving site has no forklift, the driver helps. The two may not conflict.',
      ],
    },
    {
      heading: 'What I would ask next',
      items: [
        'After the customer phones the office, how does the job reach a driver?',
        'What happens if the pallet is not ready when the driver arrives?',
        'Who agrees the price with the customer, and when?',
        'How does the customer pay, and when?',
        'Murat, how do you see waiting time at the warehouse?',
      ],
    },
    {
      heading: 'What this may mean for the software',
      caveat: 'My reading, not the owners’ words.',
      items: [
        'Jobs seem to start with a phone call, so office staff may be the first people to enter jobs, not customers.',
        'Waiting time may need to be recorded for each job if it affects the charge.',
        'Unloading seems to differ by site, so a job may need a note about the receiving site.',
      ],
    },
  ],
}

export const seeds: Record<string, RoomSeed | undefined> = { pallet: palletSeed }
export const sampleNotes: Record<string, SampleNote | undefined> = { pallet: palletNote }

// The prototype opens as the owner who has not joined yet.
export const startingViewer = 'murat'
