import type { Strings } from './en'

// Typed as Strings so a missing or extra key fails the build.
const tr: Strings = {
  app: {
    loading: 'Yükleniyor…',
    name: 'Idea Discovery Rooms',
    tagline: 'Bir fikri birlikte anlamak',
  },
  roles: {
    owner: 'İş sahibi',
    consultant: 'Yazılım danışmanı',
    assistant: 'Yapay zekâ yardımcısı',
  },
  nav: {
    project: 'Proje',
    idea: 'Fikir',
    discussion: 'Sohbet',
    summary: 'Ortak özet',
    projects: 'Projeler',
  },
  status: {
    draft: 'Taslak · Teyit bekliyor',
    needsConfirmation: 'Teyit bekliyor',
    examplesOnly: 'Yalnızca örnek',
  },
  language: {
    label: 'Dil',
  },
  auth: {
    signOut: 'Çıkış yap',
    home: {
      title: 'Fikrinizi birlikte netleştirin',
      intro:
        'Yazılım danışmanınızla bir iş fikrini birlikte netleştirdiğiniz ortak bir alan. Bir yapay zekâ yardımcısı da sorular sorarak yardımcı olur.',
      emailLabel: 'E-posta adresiniz',
      emailMissing: 'Devam etmek için e-posta adresinizi yazın.',
      submit: 'Bana giriş bağlantısı gönder',
      sentTitle: 'E-postanızı kontrol edin',
      sent: '{email} adresiyle davet edildiyseniz, giriş bağlantınız birkaç dakika içinde bu adrese gelecek.',
      sentHint:
        'Bağlantı 30 dakika geçerlidir. Birden fazla kez isterseniz en son gelen e-postayı kullanın. Birkaç dakikada gelmezse spam klasörünüze bakın.',
      askAgain: 'Yeniden iste',
      invitationNote:
        'Şifre yok: her seferinde size e-postayla bir bağlantı göndeririz. Yalnızca danışmanınızın davet ettiği kişiler giriş yapabilir. İlk kez mi geliyorsunuz? Davet e-postanızdaki bağlantıyı kullanın.',
    },
    signIn: {
      title: 'Giriş yap',
      explain: 'Devam etmek için düğmeye basın. Bunu yalnızca bağlantı size gönderildiyse yapın.',
      button: 'Giriş yap',
      invalidTitle: 'Bu bağlantı çalışmıyor',
      invalidHelp:
        'Daha önce giriş yaptıysanız aşağıdan yeni bir bağlantı isteyin. Bu sizin davet bağlantınızsa ya da başka birinin açtığını düşünüyorsanız danışmanınıza haber verin.',
    },
    signedInAs: '{name} olarak giriş yaptınız',
  },
  askToJoin: {
    title: 'Katılma isteği gönderin',
    intro:
      'Bu bağlantı, bir iş fikrinin konuşulmasına katılabilmeniz için paylaşıldı. Adınızı yazın; kimin katılacağına bu işi yürüten danışman karar verecek.',
    closedTitle: 'Bu bağlantıyla katılamazsınız',
    checking: 'Bağlantı kontrol ediliyor…',
    nameLabel: 'Adınız',
    nameHint:
      'Bu adı danışmanınız, katıldıktan sonra da diğer kişiler görür. Yalnızca harf kullanın; boşluk, kesme işareti, tire ve nokta olabilir.',
    nameMissing: 'Devam etmek için adınızı yazın.',
    emailLabel: 'E-posta adresiniz (isteğe bağlı)',
    emailHint: 'Bunu yalnızca danışmanınız sizi tanıyabilsin diye soruyoruz. Bu adrese hiçbir şey göndermeyiz.',
    submit: 'İstek gönder',
    sending: 'Gönderiliyor…',
    pendingTitle: 'Danışmanınızın yanıtı bekleniyor',
    pending:
      'İsteğiniz danışmanınıza iletildi. Durumuna bakmak için iki gün içinde bu bağlantıyı aynı telefon ya da bilgisayarda, aynı yoldan yeniden açın.',
    rejectedTitle: 'İsteğiniz kabul edilmedi',
    rejected:
      'Danışman bu isteği kabul etmedi. Bir yanlışlık olduğunu düşünüyorsanız bağlantıyı size gönderen kişiye söyleyin.',
    expiredTitle: 'Bu isteğin süresi doldu',
    expired: 'İki gün içinde yanıtlanmadı ya da kullanılmadı. Yeniden istek gönderebilirsiniz.',
    askAgain: 'Yeniden istek gönder',
    approvedTitle: 'Katılabilirsiniz',
    approved: 'Danışmanınız isteğinizi kabul etti. Girmek için Devam’a basın.',
    continue: 'Devam',
    continuing: 'Açılıyor…',
    tryAgain: 'Tekrar dene',
  },
  errors: {
    linkNotValid: 'Bu bağlantı artık çalışmıyor. Daha önce kullanılmış ya da süresi dolmuş olabilir.',
    tooManyTries: 'Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.',
    network: 'İnternet bağlantınız kesildi. Kontrol edip tekrar deneyin.',
    generic: 'Bir şeyler ters gitti. Tekrar deneyin.',
    nameNotValid:
      'Bu adı kullanamadık. Yalnızca harf, boşluk, kesme işareti (\'), tire (-) ve nokta (.) kullanın; rakam ya da başka işaret olmasın.',
    joinTryLater:
      'Biraz sonra yeniden deneyin.',
    joinClosed:
      'Bağlantı kapatılmış ya da yanlış kopyalanmış olabilir. Size gönderen kişiden yeni bir bağlantı isteyin.',
    cannotClaim:
      'Bu onay artık kullanılamıyor. Daha önce kullanılmış ya da iki günden eski olabilir. Danışmanınızdan sizi yeniden kabul etmesini isteyin.',
  },
  notices: {
    signedOut: 'Oturumunuz kapandı. Devam etmek için aşağıdan yeni bir bağlantı isteyin.',
    signedOutByYou: 'Çıkış yaptınız.',
    projectGone: 'Bu projeyi bulamadık. Yer aldığınız projeler aşağıda.',
  },
  projects: {
    title: 'Projeleriniz',
    sub: 'Danışmanınızla birlikte üzerinde çalıştığınız fikirler.',
    empty: 'Gösterilecek proje yok. Bir proje bekliyorsanız danışmanınıza sorun.',
    open: 'Projeyi aç',
  },
  idea: {
    join: 'Sohbete katıl',
    purposeTitle: 'Bu ne için?',
    notYetTitle: 'Henüz ne yapmıyoruz?',
    flowTitle: 'Bir iş nasıl ilerleyebilir?',
    flowSub: 'Bir işin baştan sona ilk hâli. Yanlışsa lütfen düzeltin.',
    unknownStep: 'Henüz bilinmiyor',
    understandingTitle: 'Şimdiye kadar ne anladık?',
    understandingSub: 'Kısa bir konuşmadan. Buradaki hiçbir şey kesin değil.',
    interpretationsTitle: 'İlk yorumlar',
    unclearTitle: 'Henüz net olmayanlar',
    noteTitle: 'Bunlar ilk yorumlarımız',
    note: 'Bunlar not ve varsayımdır, kesinleşmiş istekler değildir. Neyin doğru, neyin farklı olduğunu bize söyleyin.',
    seeSummary: 'Ortak özeti aç',
    similarTitle: 'Benzer işler',
    similarSub: 'Yalnızca konuşmaya yardımcı olsun diye. Fikriniz bunlardan birine benzemek zorunda değil.',
    visit: 'Web sitesine bak',
    empty: 'Buraya henüz bir şey yazılmadı.',
  },
  join: {
    title: 'Sohbete katılın',
    intro: 'Kimin yazdığı anlaşılsın diye adınızı yazın.',
    nameLabel: 'Adınız',
    nameHint: 'Diğer kişiler bu adı görecek.',
    nameMissing: 'Devam etmek için adınızı yazın.',
    submit: 'Sohbete katıl',
  },
  discussion: {
    title: 'Sohbet',
    sub: 'Kısa sorular, serbest cevaplar. Ne zaman uygunsa yazın.',
    participants: 'Katılımcılar',
    close: 'Kapat',
    notJoined: 'Henüz katılmadı',
    assistantRole: 'Fikri anlamak için sorular sorar',
    messageLabel: 'Mesaj',
    placeholder: 'Mesaj yazın',
    send: 'Gönder',
    replyWillFollow: 'Yanıt gelecek.',
    translated: 'Çeviri',
    translationPlaceholder: 'Gerçek uygulamada çeviri burada görünür.',
    scripted: 'Örnek yanıt',
    simulatedTitle: 'Buradaki yanıtlar örnektir',
    simulatedBody:
      'Yardımcının yanıtları önceden yazılmıştır, yapay zekâ yazmıyor. Mesajlar bu tarayıcıda kalır, kimseyle paylaşılmaz.',
    empty: 'Henüz mesaj yok.',
  },
  summary: {
    title: 'Ortak özet',
    sub: 'Onaylananlar, şimdilik düşündüklerimiz ve hâlâ açık olanlar.',
    confirmed: 'Onaylandı',
    confirmedHelp: 'Yalnızca üzerinde anlaşılan ve onaylananlar.',
    early: 'İlk yorumlar',
    earlyHelp: 'Ne demek istediğinizi böyle anladık. Her biri doğru mu, söyleyin.',
    open: 'Açık sorular',
    openHelp: 'Henüz net olmayan noktalar.',
    awaiting: 'Teyit bekliyor',
    right: 'Doğru',
    notRight: 'Doğru değil',
    correctionLabel: 'Farklı olan ne?',
    correctionPlaceholder: 'Farklı olanı yazın',
    sendCorrection: 'Gönder',
    cancel: 'Vazgeç',
    empty: 'Henüz bir şey yok.',
  },
}

export default tr
