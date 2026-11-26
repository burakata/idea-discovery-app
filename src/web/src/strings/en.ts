// Owner-facing text. English is the source; every key must also exist in tr.ts.
const en = {
  app: {
    loading: 'Loading…',
    name: 'Idea Discovery Rooms',
    tagline: 'Understanding an idea together',
  },
  roles: {
    owner: 'Business owner',
    consultant: 'Software consultant',
    assistant: 'AI assistant',
  },
  nav: {
    project: 'Project',
    idea: 'The idea',
    discussion: 'Discussion',
    summary: 'Shared summary',
    projects: 'Projects',
    // Burak's own links inside a room.
    forYou: 'For you',
    people: 'People',
  },
  status: {
    draft: 'Draft · Needs confirmation',
    needsConfirmation: 'Needs confirmation',
    examplesOnly: 'Examples only',
  },
  language: {
    label: 'Language',
  },
  auth: {
    signOut: 'Sign out',
    home: {
      title: 'Work out your idea together',
      intro:
        'A shared place where you and your software consultant work out a business idea together. An AI assistant helps by asking questions.',
      emailLabel: 'Your email address',
      emailMissing: 'Write your email address to continue.',
      submit: 'Email me a sign-in link',
      sentTitle: 'Check your email',
      sent: 'If you were invited with {email}, a sign-in link will arrive there in a few minutes.',
      sentHint:
        'The link works for 30 minutes. If you ask more than once, use the newest email. Nothing after a few minutes? Check your spam folder.',
      askAgain: 'Ask again',
      invitationNote:
        'There is no password: each time, we email you a link. Only people your consultant has invited can sign in. First time here? Use the link in your invitation email.',
    },
    signIn: {
      title: 'Sign in',
      explain: 'Press the button to continue. Only do this if the link was sent to you.',
      button: 'Sign in',
      invalidTitle: 'This link does not work',
      invalidHelp:
        'If you have signed in before, ask for a new link below. If this was your invitation, or you think someone else opened it, tell your consultant.',
    },
    signedInAs: 'Signed in as {name}',
  },
  // Asking to join a project: the page behind a project link. It says nothing of the project.
  askToJoin: {
    title: 'Ask to join',
    intro:
      'Someone shared this link so you can take part in talking through a business idea. Write your name and the consultant running it will decide whether to let you in.',
    closedTitle: 'This link cannot be used to join',
    checking: 'Checking the link…',
    nameLabel: 'Your name',
    nameHint:
      'Your consultant sees this name, and so do the others once you join. Use letters only; spaces, apostrophes, hyphens and full stops are fine.',
    nameMissing: 'Write your name to continue.',
    emailLabel: 'Your email address (optional)',
    emailHint: 'We ask only so your consultant can recognise you. We will not send anything to it.',
    submit: 'Ask to join',
    sending: 'Sending…',
    pendingTitle: 'Waiting for your consultant’s answer',
    pending:
      'Your request has been sent to your consultant. To check on it, open this same link again the same way on this phone or computer, within two days.',
    rejectedTitle: 'Your request was not accepted',
    rejected:
      'The consultant did not accept this request. If you think this is a mistake, tell the person who sent you the link.',
    expiredTitle: 'This request has expired',
    expired: 'It was not answered, or not used, within two days. You can ask again.',
    askAgain: 'Ask again',
    approvedTitle: 'You can join',
    approved: 'Your consultant accepted your request. Press Continue to go in.',
    continue: 'Continue',
    continuing: 'Opening…',
    tryAgain: 'Try again',
  },
  errors: {
    linkNotValid: 'This link no longer works. It may have been used already or be too old.',
    tooManyTries: 'Too many tries. Wait a little, then try again.',
    network: 'Connection lost. Check your internet and try again.',
    generic: 'Something went wrong. Try again.',
    nameNotValid:
      'We could not use that name. Use only letters, spaces, apostrophes (\'), hyphens (-) and full stops (.), with no numbers or other signs.',
    joinTryLater:
      'Try again in a little while.',
    joinClosed:
      'It may have been switched off, or copied incorrectly. Ask the person who sent it to you for a new way in.',
    cannotClaim:
      'This acceptance can no longer be used. It may already have been used, or be more than two days old. Ask your consultant to accept you again.',
    conversationFinished: 'This conversation has already been finished.',
    conversationActive: 'A conversation is already open. It is shown on this page now.',
    messageNotValid: 'That message could not be sent. Check that it is not empty, then try again.',
    messageTooLong: 'That message could not be sent. It may be too long: shorten it, or split it into two.',
  },
  notices: {
    signedOut: 'You have been signed out. Ask for a new link below to carry on.',
    signedOutByYou: 'You have signed out.',
    projectGone: 'We could not find that project. Here are the projects you are in.',
  },
  projects: {
    title: 'Your projects',
    sub: 'The ideas you are working on with your consultant.',
    empty: 'There are no projects to show. If you expected one, ask your consultant.',
    open: 'Open project',
  },
  room: {
    conversation: 'Conversation {number}',
    finished: 'Finished',
    active: 'Active',
    finishedOn: 'Finished {date}',
  },
  idea: {
    join: 'Join discussion',
    purposeTitle: 'What this is for',
    purposePoints: [
      'Put the idea into simple words together',
      'Answer a few short questions in the discussion, whenever suits you',
      'Look at similar businesses, if that helps',
    ],
    notYetTitle: 'What we are not doing yet',
    notYetPoints: [
      'We are not discussing technical details',
      'We are not finalising a list of features',
      'We are not discussing what the software would cost or how long it would take',
    ],
    flowTitle: 'How it might work, step by step',
    flowSub: 'A first picture, step by step. Tell us in the discussion what is different.',
    unknownStep: 'Not known yet',
    understandingTitle: 'What we understand so far',
    understandingSub: 'What we think so far. None of it is settled.',
    interpretationsTitle: 'Early interpretations',
    unclearTitle: 'What is still unclear',
    unclearSub: 'Questions we would like to ask you in the discussion.',
    noteTitle: 'These are our early interpretations',
    note: 'They are notes and assumptions, not agreed requirements. Tell us what is right and what is different.',
    seeSummary: 'Open shared summary',
    similarTitle: 'Similar businesses',
    similarSub: 'Only here to help the conversation. Your idea does not have to match any of them.',
    similarQuestion: 'Which of these feels closest to your idea, and what would be different?',
    visit: 'Visit website',
    empty: 'Nothing here yet.',
  },
  discussion: {
    sub: 'Short questions. Answer in your own words, whenever suits you.',
    pickLabel: 'Conversations',
    participants: 'Participants',
    close: 'Close',
    messageLabel: 'Message',
    placeholder: 'Write a message',
    send: 'Send',
    replyWillFollow: 'Sent. A reply will come here, though it may take a while.',
    translated: 'Translated',
    left: 'no longer in this project',
    retrying: 'Connection lost. New messages will appear when it is back.',
    finishedNote: 'This conversation is finished. You can read it; to write, choose the current conversation above.',
    finishedWaiting: 'This conversation is finished. You can still read it. If there is more to talk about, your consultant will start a new one.',
    finish: 'Finish conversation',
    finishTitle: 'Finish conversation {number}?',
    finishBody:
      'Nobody will be able to write in it any more, and this cannot be undone. Everyone can still read it.',
    finishConfirm: 'Finish conversation',
    cancel: 'Cancel',
    start: 'Start conversation {number}',
    empty: 'No messages yet. The first question will appear here, or you can write first.',
    loading: 'Loading messages…',
    emptyFinished: 'No messages were written in this conversation.',
    finishedNoneConsultant: 'This conversation is finished. You can read it, or start a new one above.',
    draftKept:
      'Your consultant finished this conversation before your message was sent. Your text is still here, so you can copy it.',
    draftKeptConsultant:
      'This conversation was finished before your message was sent. Your text is still here, so you can copy it.',
    charCount: '{count} of {max}',
    newMessage: 'New message from {name}',
    newerTitle: 'A newer conversation has started.',
    newerGo: 'Go to conversation {number}',
  },
  summary: {
    title: 'Shared summary',
    sub: 'What is confirmed, what we think so far, and what is still open.',
    confirmed: 'Confirmed',
    confirmedHelp: 'Only what has been agreed and confirmed.',
    early: 'Early interpretations',
    earlyHelp: 'What we think you mean. Tell us whether each one is right.',
    open: 'Open questions',
    openHelp: 'Points that are still unclear.',
    awaiting: 'Awaiting confirmation',
    right: 'Right',
    notRight: 'Not right',
    correctionLabel: 'What is different?',
    correctionPlaceholder: 'Write what is different',
    sendCorrection: 'Send',
    cancel: 'Cancel',
    empty: 'Nothing here yet.',
    nothingShared: 'Nothing has been shared yet.',
  },
}

export type Strings = typeof en

export default en
