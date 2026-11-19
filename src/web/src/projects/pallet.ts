import { assistant, burak, type Bilingual, type Project, type StartingStatement } from './types'

// Wording follows docs/reference/feedback-document.pdf and
// prompts/idea-context.pallet.md. Keep all three in step.

// The four points on page 2 of the feedback document.
const understanding: (Bilingual & { id: string })[] = [
  {
    id: 'pallets-between',
    en: 'The idea is to transport prepared pallets from one warehouse or business to another.',
    tr: 'Fikir, hazırlanmış paletleri bir depodan ya da işletmeden diğerine taşımak.',
  },
  {
    id: 'driver-no-packing',
    en: 'The driver is not expected to pack the goods.',
    tr: 'Şoförden malları paketlemesi beklenmiyor.',
  },
  {
    id: 'loading-unloading',
    en: 'Loading and unloading may not be part of the driver’s role.',
    tr: 'Yükleme ve boşaltma şoförün işi olmayabilir.',
  },
  {
    id: 'waiting-charges',
    en: 'There may be extra charges for waiting time.',
    tr: 'Bekleme süresi için ek ücret alınabilir.',
  },
]

// Further early interpretations from the idea context.
const furtherInterpretations: (Bilingual & { id: string })[] = [
  {
    id: 'by-appointment',
    en: 'Jobs may be booked by appointment.',
    tr: 'İşler randevuyla alınıyor olabilir.',
  },
  {
    id: 'supplier-customers',
    en: 'Customers may include suppliers who currently deliver with their own truck and staff.',
    tr: 'Müşteriler arasında, şu an kendi kamyonu ve elemanıyla dağıtım yapan tedarikçiler olabilir.',
  },
  {
    id: 'own-van',
    en: 'You may start with your own van.',
    tr: 'İşe kendi aracınızla başlamayı düşünüyor olabilirsiniz.',
  },
]

const unclear: (Bilingual & { id: string })[] = [
  { id: 'who-asks', en: 'Who asks for a job, and how?', tr: 'İşi kim, nasıl istiyor?' },
  { id: 'who-prices', en: 'Who sets the price?', tr: 'Fiyatı kim belirliyor?' },
  { id: 'driver-gets-job', en: 'How does a driver get a job?', tr: 'Şoför işi nasıl alıyor?' },
  { id: 'payment', en: 'How does payment work?', tr: 'Ödeme nasıl yapılıyor?' },
]

const statements: StartingStatement[] = [
  ...[...understanding, ...furtherInterpretations].map(({ id, en, tr }) => ({
    id,
    group: 'early' as const,
    text: { en, tr },
  })),
  ...unclear.map(({ id, en, tr }) => ({ id, group: 'open' as const, text: { en, tr } })),
]

export const pallet: Project = {
  id: 'pallet',
  name: { en: 'Pallet transport', tr: 'Palet taşımacılığı' },
  status: { en: 'Early idea · draft', tr: 'İlk fikir · taslak' },
  icon: 'pallet',
  illustration: 'warehouse',
  intro: {
    eyebrow: { en: 'Early idea · let’s clarify it together', tr: 'İlk fikir · birlikte netleştirelim' },
    title: { en: 'Tell us what you have in mind.', tr: 'Aklınızdaki işi birlikte anlayalım.' },
    lead: {
      en: 'This page is for understanding the business you have in mind and hearing your first thoughts. For now the goal is not detail, but to make the idea clear in simple terms.',
      tr: 'Bu sayfa, aklınızdaki işi anlamak ve ilk düşüncelerinizi duymak için. Şimdilik amaç ayrıntıya girmek değil, fikri basitçe netleştirmek.',
    },
    purpose: [
      { en: 'Summarise the idea in simple terms', tr: 'Fikri basitçe özetlemek' },
      {
        en: 'Look at similar businesses and see which feel closest',
        tr: 'Benzer işlere bakıp hangisinin daha yakın olduğunu görmek',
      },
      { en: 'Hear your first feedback', tr: 'İlk görüşlerinizi almak' },
    ],
    notYet: [
      { en: 'We are not discussing technical details', tr: 'Teknik ayrıntıları konuşmuyoruz' },
      { en: 'We are not finalising a list of features', tr: 'Bir özellik listesi kesinleştirmiyoruz' },
      { en: 'We are not settling prices or timelines', tr: 'Fiyat ve süre konularını kesinleştirmiyoruz' },
    ],
  },
  jobFlow: [
    {
      id: 'sender',
      icon: 'warehouse',
      who: { en: 'Sending warehouse or business', tr: 'Gönderen depo ya da işletme' },
      what: { en: 'Has a prepared pallet to send.', tr: 'Göndereceği hazır bir palet var.' },
      unknown: false,
    },
    {
      id: 'request',
      icon: 'pallet',
      who: { en: 'Who asks for the job?', tr: 'İşi kim istiyor?' },
      what: { en: 'And how does it reach a driver?', tr: 'İş şoföre nasıl ulaşıyor?' },
      unknown: true,
    },
    {
      id: 'driver',
      icon: 'van',
      who: { en: 'Driver', tr: 'Şoför' },
      what: { en: 'Collects the pallet and transports it.', tr: 'Paleti alır ve taşır.' },
      unknown: false,
    },
    {
      id: 'receiver',
      icon: 'warehouse',
      who: { en: 'Receiving warehouse or business', tr: 'Teslim alan depo ya da işletme' },
      what: { en: 'The pallet is delivered.', tr: 'Palet teslim edilir.' },
      unknown: false,
    },
  ],
  understanding: understanding.map(({ en, tr }) => ({ en, tr })),
  unclear: unclear.map(({ en, tr }) => ({ en, tr })),
  similarBusinesses: [
    {
      name: 'Courier Exchange',
      url: 'https://courierexchange.co.uk/',
      how: {
        en: 'Transport companies share the jobs they have available, much like a noticeboard.',
        tr: 'Nakliye firmaları ellerindeki işleri paylaşır; bir ilan panosu gibi çalışır.',
      },
    },
    {
      name: 'Shiply',
      url: 'https://www.shiply.com/',
      how: {
        en: 'Customers post a job and drivers compete by offering prices.',
        tr: 'Müşteri işi yazar, şoförler fiyat vererek yarışır.',
      },
    },
    {
      name: 'DigiHaul',
      url: 'https://digihaul.com/',
      how: {
        en: 'Customers see a price, and the company manages more of the job itself.',
        tr: 'Müşteri bir fiyat görür; işin daha büyük kısmını firma kendisi yönetir.',
      },
    },
    {
      name: 'PalletOnline',
      url: 'https://palletonline.co.uk/',
      how: {
        en: 'Customers book pallet transport online, as a more standard service.',
        tr: 'Müşteri palet taşımasını internetten ayırtır; daha standart bir hizmettir.',
      },
    },
  ],
  similarQuestion: {
    en: 'Which of these feels closest to your idea, and what would be different?',
    tr: 'Bunlardan hangisi fikrinize daha yakın, farklı olan ne olurdu?',
  },
  participants: [
    { id: 'selin', role: 'owner', name: 'Selin Aydın', language: 'tr', joined: true },
    { id: 'murat', role: 'owner', name: 'Murat Kaya', language: 'en', joined: false },
    { id: 'david', role: 'owner', name: 'David Harper', language: 'en', joined: true },
    burak,
    assistant,
  ],
  statements,
  printVersion: { en: '/feedback-document.pdf' },
}
