# Integrations

Every outside service and main building block the app depends on: what it
does, why we need it, what data it sees and whether it is in use yet. The
decisions behind each are in [decisions.md](decisions.md).

When one is added, changed or removed, update this file in the same pull
request.

## At a glance

| Name | What it is for | Sees owners' data? | Status |
|---|---|---|---|
| [Hetzner](#hetzner) | The server the real app runs on (Germany) | Yes, stores the database and images | Planned, M1 PR 9 |
| [Docker](#docker) | Packs the app so it runs the same everywhere | No (runs on our server) | Planned, M1 PR 9 |
| [Caddy](#caddy) | The front door: HTTPS and what visitors can reach | Passes it through | Decided; planned, M1 PR 9 |
| [Let's Encrypt](#lets-encrypt) | Free HTTPS certificates, fetched by Caddy | No, only the address | Planned, M1 PR 9 |
| [Resend](#resend) | Sends the sign-in and invitation emails | Yes: names, email addresses, links. Stored by Resend, possibly in the US | Planned, M1 PR 9 |
| [SkiaSharp](#skiasharp) | Cleans and resizes uploaded project images | No (runs on our server) | In use, M1 PR 8c |
| [Claude API](#claude-api) | The AI assistant | Yes: conversation content | Planned, M2 |
| [GitHub](#github) | Code, checks on every change, the public demo, the app's published images | No (demo data only; the images hold no data) | In use; images from M1 PR 9 |

"Runs on our server" means the code is part of the app itself: nothing
leaves the server because of it.

## How they fit together

A visitor's browser reaches **Caddy** over HTTPS (certificate from
**Let's Encrypt**). Caddy passes the request to the app, which runs in a
**Docker** box on a **Hetzner** server in Germany. The images come from GitHub's registry. When Burak uploads a
picture, **SkiaSharp** cleans it before it is stored. When someone needs a
sign-in link, the app asks **Resend** to email it. From M2, the app sends
conversation text to the **Claude API** and gets the AI's drafts back.

## Hetzner

**The computer the app runs on.** The app has to live on a machine that is
always on and reachable from the internet. Hetzner rents small servers by the
month for a few euros. Its data centres are in Germany, so what the app
stores itself (the database and images) stays in Europe. Email is different:
see Resend, which keeps email content and delivery data outside the server.

- **Data:** everything the app stores: the SQLite database (people,
  projects, messages, sign-in records) and uploaded images, on the server's
  own disk.
- **Privacy notice:** yes, as where the data is stored.
- **Decided:** 2026-11-20 (hosting rows in decisions.md).

## Docker

**A sealed box for the app.** The app needs a particular .NET version, the
image library and some settings. Docker packs all of that into one image that
runs the same on a laptop, in CI and on the server. Without it the server is
set up by hand and slowly drifts from what was tested. Updating means
swapping in the new box; rolling back means going back to the old one.

- **Data:** none of its own. The database and images live in a folder on the
  server's disk that the box uses, so they survive updates.
- **Decided:** 2026-11-20 (hosting row).

## Caddy

**The front door, which gives us HTTPS.** Browsers need HTTPS (the padlock)
before sign-in cookies can be sent safely. Caddy sits in front of the app,
gets and renews free certificates automatically, and decides what visitors
can reach: the pages, and the API only under `/api`. Without it someone would
renew certificates by hand, and the API would face the internet directly.

- **Data:** every request passes through it on our own server; it stores
  nothing about owners.
- **Decided:** 2026-11-27 (M1 PR 9b): the official `caddy:2` image, with the
  client's files and the Caddyfile baked in. Setup: [deployment.md](deployment.md).

## Let's Encrypt

**Free HTTPS certificates.** Caddy asks Let's Encrypt for the certificate for
the app's address and renews it before it runs out.

- **Data:** only the app's address (the subdomain). No owner data.
- **Status:** comes with Caddy.

## Resend

**The service that sends sign-in emails.** The app asks Resend to deliver a
one-time link to the invited person. Resend handles email delivery; the app
remains responsible for creating, expiring and checking the link. Resend
processes and stores email information outside the Hetzner server, and some
of that may be in the US, so it must be included in the privacy notice. Not
everything about the owners stays in Europe because of this.

- **Data:** the recipient's name and email address, and the email's text,
  including the sign-in link.
- **Sends from:** `rooms.<Burak's domain>`, checked by SPF and DKIM records.
  The domain is set on the server only, never in the code.
- **Free plan:** 100 emails a day, 3,000 a month (checked 2026-11-27; check
  again when the account is created).
- **Privacy notice:** yes. Where Resend stores data is checked and recorded
  when the account is created (M1 PR 9).
- **Replaceable:** the app sends through an adapter, so another email
  service can be configured later.
- **Decided:** 2026-11-20 (email rows).

## SkiaSharp

**Cleans uploaded images.** An uploaded file can hide things: a phone
photo's location, or content made to attack a browser. SkiaSharp redraws every
upload as a fresh WebP image, which reduces risk and strips the metadata we
test for (it does not make every file safe), and it shrinks very large
photos. It is a code library (MIT licence, .NET
Foundation), not an outside service.

- **Data:** the uploaded image, on our own server only.
- **For deployment:** it needs its Linux library inside the Docker image, and
  redrawing a very large photo briefly uses about 160 MB of memory, so the
  server needs enough memory.
- **Decided:** 2026-11-26.

## Claude API

**The AI assistant.** From M2 the Lead and the private specialists are
written by Claude. Only the server calls it; the key never reaches a browser.

- **Data:** the conversation text and project content the AI needs for each
  task, kept to the minimum (PRD §10).
- **Privacy notice:** yes. Where Anthropic processes and keeps data is
  checked and recorded when it is set up (M2).
- **Replaceable:** called through a provider adapter; the model is set in
  configuration.
- **Decided:** 2026-11-20 (AI provider row).

## GitHub

**Where the code lives and is checked.** The repository, the pull requests,
the CI checks that run on every change, and GitHub Pages, which hosts the
public demo.

- **Data:** none of the owners'. The demo uses invented sample data and keeps
  everything in the visitor's own browser.
- **Container registry (GHCR):** CI builds the app's two Docker images (the
  API, and Caddy with the client) and publishes them, tagged with the commit,
  to GitHub's container registry when a change is merged to `main`. The
  images are public and hold no settings or data; the server runs one commit's
  tag, never `latest`. Decided 2026-11-27 (M1 PR 9b).
