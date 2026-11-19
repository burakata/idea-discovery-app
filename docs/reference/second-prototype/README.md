# Idea Discovery Rooms — Pallet Transport (UI Prototype)

A single-page Turkish/English concept prototype for a collaborative AI-assisted business discovery room. Open `index.html` in a browser. It needs no server or dependencies for the demo.

## What works
- Turkish/English language switch
- Project introduction, with four previously-created visual pages (click to enlarge)
- Competitor examples, without forcing the idea into any existing model
- Discussion UI with four switchable sample participant identities and scripted AI-style questions
- Browser-local chat history and lightweight summary confirmation
- Export of the conversation and current summary as a text file
- Responsive layout for phones and desktops

## What does NOT work yet (important)
- **No genuine AI interaction:** the simulated AI responses are a fixed sequence; they are intentionally marked as such.
- **No true collaboration:** local browser storage is not shared across devices or users.
- **No real accounts, permissions, invitations, audit history, consent flow, or secure storage.** Do not use this demo to collect actual customer information or publish it as a working private collaboration site.
- English mode switches interface text, but visual reference images contain their original Turkish text.

## For a real MVP
Build authentication, project membership and permissions, persistent database, asynchronous shared message threads, and an AI backend. You can reuse the UI and introductory content. Keep client/API keys out of frontend code.

Suggested baseline: ASP.NET Core API, a database, server-side OpenAI API integration, and responsive web UI. The system should explicitly mark AI hypotheses as unconfirmed and require human approval before they are treated as facts.

## Reuse for other projects
Extract texts, images, owners and competitor references into per-project configuration. The interview and summary components can remain the same for future project rooms.
