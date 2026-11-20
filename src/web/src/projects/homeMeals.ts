import { assistant, burak, type Bilingual, type Project, type StartingStatement } from './types'

// An invented sample project for the public demo. Nobody real said any of it.
// Keep it in step with prompts/idea-context.home-meals.md.

// The four points shown under "What we understand so far".
const understanding: (Bilingual & { id: string })[] = [
  {
    id: 'neighbours-buy',
    en: 'The idea is that people who cook at home sell meals to their neighbours.',
    tr: 'Fikir, evde yemek yapan insanların yemeklerini komşularına satması.',
  },
  {
    id: 'nearby-customers',
    en: 'Customers are mostly people who live nearby.',
    tr: 'Müşteriler çoğunlukla yakında oturan insanlar.',
  },
  {
    id: 'cook-chooses',
    en: 'Each cook decides what to make.',
    tr: 'Ne pişireceğine her yemek yapan kendisi karar veriyor.',
  },
  {
    id: 'order-ahead',
    en: 'Meals are ordered a day ahead.',
    tr: 'Yemekler bir gün önceden sipariş ediliyor.',
  },
]

// Further early interpretations from the idea context.
const furtherInterpretations: (Bilingual & { id: string })[] = [
  {
    id: 'small-portions',
    en: 'Each cook makes only a few portions at a time.',
    tr: 'Her yemek yapan bir seferde yalnızca birkaç porsiyon hazırlıyor.',
  },
  {
    id: 'start-small',
    en: 'The plan is to start with a few cooks you already know.',
    tr: 'Plan, zaten tanıdığınız birkaç yemek yapan kişiyle başlamak.',
  },
]

const unclear: (Bilingual & { id: string })[] = [
  { id: 'how-ordered', en: 'How does a neighbour ask for a meal?', tr: 'Komşu bir yemek istediğinde ne yapıyor?' },
  { id: 'who-delivers', en: 'How does the meal reach the neighbour?', tr: 'Yemek komşuya nasıl ulaşıyor?' },
  { id: 'payment', en: 'How is payment taken?', tr: 'Ödeme nasıl alınıyor?' },
  { id: 'who-prices', en: 'Who sets the price of a meal?', tr: 'Bir yemeğin fiyatını kim belirliyor?' },
]

const statements: StartingStatement[] = [
  ...[...understanding, ...furtherInterpretations].map(({ id, en, tr }) => ({
    id,
    group: 'early' as const,
    text: { en, tr },
  })),
  ...unclear.map(({ id, en, tr }) => ({ id, group: 'open' as const, text: { en, tr } })),
]

export const homeMeals: Project = {
  id: 'home-meals',
  name: { en: 'Home-cooked meals', tr: 'Ev yemekleri' },
  status: { en: 'Early idea · draft', tr: 'İlk fikir · taslak' },
  icon: 'idea',
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
      {
        en: 'We are not discussing what the software would cost or how long it would take',
        tr: 'Yazılımın maliyetini ya da ne kadar süreceğini konuşmuyoruz',
      },
    ],
  },
  jobFlow: [
    {
      id: 'cook',
      icon: 'people',
      who: { en: 'Home cook', tr: 'Evde yemek yapan' },
      what: {
        en: 'Cooks a meal to sell.',
        tr: 'Satmak için yemek pişirir.',
      },
      unknown: false,
    },
    {
      id: 'ask',
      icon: 'discussion',
      who: { en: 'Neighbour', tr: 'Komşu' },
      what: { en: 'Wants a meal.', tr: 'Bir yemek ister.' },
      unknown: false,
    },
    {
      id: 'handover',
      icon: 'send',
      who: {
        en: 'How does the meal reach the neighbour, and how do they pay?',
        tr: 'Yemek komşuya nasıl ulaşıyor, ödeme nasıl yapılıyor?',
      },
      what: { en: 'Nobody has said yet.', tr: 'Henüz kimse söylemedi.' },
      unknown: true,
    },
    {
      id: 'eat',
      icon: 'check',
      who: { en: 'Neighbour', tr: 'Komşu' },
      what: { en: 'Gets the meal.', tr: 'Yemeği alır.' },
      unknown: false,
    },
  ],
  understanding: understanding.map(({ en, tr }) => ({ en, tr })),
  unclear: unclear.map(({ en, tr }) => ({ en, tr })),
  // Plain descriptions of ways of working. The labels are generic, not companies.
  similarBusinesses: [
    {
      name: { en: 'Neighbourhood noticeboard', tr: 'Mahalle ilan panosu' },
      how: {
        en: 'Neighbours post what they have cooked, and others get in touch to ask for a portion.',
        tr: 'Komşular pişirdikleri yemeği duyurur, isteyenler bir porsiyon için onlara ulaşır.',
      },
    },
    {
      name: { en: 'Shared kitchen', tr: 'Ortak mutfak' },
      how: {
        en: 'Several cooks use one place to prepare meals, and customers collect them from there.',
        tr: 'Birkaç kişi yemeklerini tek bir yerde hazırlar, müşteriler yemeği oradan alır.',
      },
    },
    {
      name: { en: 'Weekly meal plan', tr: 'Haftalık yemek planı' },
      how: {
        en: 'Customers choose their meals for the week, and they are made and brought on set days.',
        tr: 'Müşteri haftalık yemeklerini seçer; yemekler belirli günlerde hazırlanıp getirilir.',
      },
    },
    {
      name: { en: 'Local food stall', tr: 'Yerel yemek tezgâhı' },
      how: {
        en: 'Cooks sell what they made on a fixed day in one place, and customers simply turn up.',
        tr: 'Yemek yapanlar hazırladıklarını belirli bir günde tek bir yerde satar, müşteri gelip alır.',
      },
    },
  ],
  similarQuestion: {
    en: 'Which of these feels closest to your idea, and what would be different?',
    tr: 'Bunlardan hangisi fikrinize en yakın, farklı olan ne olurdu?',
  },
  participants: [
    { id: 'elif', role: 'owner', name: 'Elif Yıldız', language: 'tr', joined: true },
    { id: 'hasan', role: 'owner', name: 'Hasan Aksoy', language: 'tr', joined: false },
    { id: 'tom', role: 'owner', name: 'Tom Bennett', language: 'en', joined: true },
    burak,
    assistant,
  ],
  statements,
}
