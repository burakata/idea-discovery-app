# Deploying the app

A step-by-step guide for Burak. You do every server, DNS and account step
yourself; nothing here goes into the repository. Wherever you see
`example.com`, use your own domain: it lives only in the server's settings.

What you end up with: one small server in Germany running two Docker
containers. **Caddy** answers on `https://rooms.<your domain>`, fetches the
HTTPS certificate by itself and passes `/api` to the **API**. The database is
a file on the server's disk. The images are built and published by CI (see
[integrations.md](integrations.md)).

**Until M4 this server holds test participants and invented data only.** See
step 9.

## 1. Hetzner: the server

1. Create a Hetzner Cloud account and a **project**.
2. Add your **SSH public key** to the project (Security, SSH keys). On
   Windows, `ssh-keygen -t ed25519` makes one; add the contents of the
   `.pub` file, never the private one.
3. Create a **firewall** (Firewalls) with inbound rules for only: TCP 22
   (SSH), TCP 80, TCP 443 and ICMP. Nothing else. Apply it to the server.
4. Create the server: location **Falkenstein** or **Nuremberg**, image
   **Ubuntu 24.04**, type: the smallest **shared x86** plan with at least
   2 GB of memory (redrawing a very large photo briefly needs about 160 MB).
   Check availability and the price when you buy. Choose the SSH key. Give it
   a **public IPv4** address. IPv6 may stay on, but we do not use it (see
   [IPv6](#ipv6)).
5. Note the server's IPv4 address.

## 2. The server: basic safety

Connect: `ssh root@<server IPv4>` (this is the last time you use root).

1. Update and turn on automatic security updates:
   ```
   apt update && apt upgrade -y
   apt install -y unattended-upgrades
   dpkg-reconfigure -plow unattended-upgrades
   ```
2. Make your own user with sudo and your key (replace `burak`):
   ```
   adduser burak
   usermod -aG sudo burak
   mkdir -p /home/burak/.ssh
   cp /root/.ssh/authorized_keys /home/burak/.ssh/
   chown -R burak:burak /home/burak/.ssh
   chmod 700 /home/burak/.ssh && chmod 600 /home/burak/.ssh/authorized_keys
   ```
3. **Keep this window open.** In a second window check that
   `ssh burak@<server IPv4>` works and `sudo whoami` prints `root`.
4. Switch off passwords and root login (as `burak`):
   ```
   printf 'PasswordAuthentication no\nPermitRootLogin no\n' | sudo tee /etc/ssh/sshd_config.d/10-hardening.conf
   sudo systemctl restart ssh
   ```
   Check from a third window that a new `ssh burak@...` still works before
   closing the others.
5. Install **Docker Engine and the Compose plugin** by following Docker's
   official steps for Ubuntu (use the "apt repository" method):
   <https://docs.docker.com/engine/install/ubuntu/>. Then let your user run
   Docker, and log out and in again:
   ```
   sudo usermod -aG docker burak
   ```
   (Being in the `docker` group is as powerful as root. That is acceptable on
   a server only you use.) Check: `docker compose version`.

## 3. DNS: the address

At the place that hosts your domain's DNS, add one record:

| Type | Name | Value |
|---|---|---|
| A | `rooms` | the server's IPv4 address |

Do **not** add an AAAA record (see [IPv6](#ipv6)). Check later with
`nslookup rooms.<your domain>`.

## 4. Resend: sending sign-in emails

1. Create an account at <https://resend.com>.
2. **Domains, Add domain**: enter `rooms.<your domain>`. Pick the region
   closest to Europe if asked.
3. Resend shows the DNS records to add. Add **exactly** what it shows, at your
   DNS host: a **DKIM** TXT record at `resend._domainkey.rooms`, and an
   **SPF** TXT record and an **MX** record at `send.rooms`. Wait until Resend
   says the domain is **Verified**.
4. Add a **DMARC** record: TXT, name `_dmarc.rooms`, value
   `v=DMARC1; p=none;`. This only asks mail providers to report; it blocks
   nothing. It can be tightened later (`p=quarantine`) once you have seen the
   reports are clean.
5. **API Keys, Create**: permission **Sending access**, domain
   `rooms.<your domain>`. Copy the key once; you paste it in step 6. Do not
   store it anywhere else.
6. Note for the privacy notice (M4): the free plan allows 100 emails a day
   and 3,000 a month (checked 2026-11-27; check again now). Resend stores
   email content and delivery data, and its servers may be outside Europe,
   including in the US. Write down where Resend says it stores data and what
   it keeps, with today's date, in [integrations.md](integrations.md) (M1
   PR 9c).

## 5. GitHub: make the images public, once

CI builds both images on every pull request and, when a change is merged to
`main`, publishes them to GitHub's container registry, tagged with the full
commit SHA. After the **first** publish:

1. GitHub, your profile, **Packages**: open `idea-discovery-app/api`, then
   **Package settings**, **Change visibility**, **Public**.
2. Do the same for `idea-discovery-app/web`.

The images hold only the app's code, no settings or data, and being public
lets the server download them without a password. Do this once; later images
inherit it.

## 6. The server: settings

1. Copy the `deploy` folder to the server from the same commit as the images.
   On your computer, from the repository folder:
   ```
   scp -r deploy burak@<server IPv4>:~/idea-discovery
   ```
2. On the server:
   ```
   cd ~/idea-discovery
   chmod +x *.sh
   sudo install -d -o 1654 -g 1654 -m 700 /srv/idea-discovery/data
   cp .env.example .env
   chmod 600 .env
   openssl rand -base64 48
   ```
   The last command prints a random key. Copy it.
3. Edit `.env` (`nano .env`) and fill in:
   - `IMAGE_TAG`: the full commit SHA of a build published from `main` (the
     repository's Actions page, or the Packages page).
   - `APP_DOMAIN` and `App__PublicBaseUrl`: `rooms.<your domain>`, and the same
     as `https://rooms.<your domain>`.
   - `Consultant__Email`: your email address, the one you sign in with.
   - `Auth__TokenKey`: the key you generated.
   - `Email__From`: for example `Rooms <noreply@rooms.<your domain>>`.
   - `Email__Resend__ApiKey`: the Resend key from step 4.

   Leave `Proxy__KnownProxy`, `DATA_DIR` and `Email__Provider` as they are.
   The file is private to you (`chmod 600`); never copy it elsewhere or paste
   it into a chat or an issue.

## 7. First start

```
cd ~/idea-discovery
docker compose up -d
docker compose ps
```

The first start downloads the images and Caddy fetches the certificate; give it
a minute. Then:

1. Open `https://rooms.<your domain>/api/health`. It should show
   `{"status":"ok"}`. (That the API answers proves its settings are valid and
   the image library works.)
2. Open `https://rooms.<your domain>`, sign in with your `Consultant__Email`
   and request a link. The email arrives from Resend; the link signs you in.

If something is wrong, see the logs (step 8). If the certificate does not
arrive, check that the DNS record points at the server and that ports 80 and
443 are open in the Hetzner firewall.

## 8. Day to day

**Update** to a new build (the commit SHA of a build published from `main`):

```
cd ~/idea-discovery
./update.sh <full-commit-sha>
```

It downloads the new images, stops the API, copies the database to
`/srv/idea-discovery/data/backups/pre-update-<sha>-<time>.db`, keeps only the
newest two copies, starts the new build and waits until it is healthy. It
prints the **previous tag**; keep it for a rollback. Database changes in the
new build are applied on start and cannot be undone, which is why rollback
restores the copy.

**Roll back** if an update goes wrong:

```
./rollback.sh <previous-sha>
```

A rollback is a security event, so the script does more than go back. It
restores the newest pre-update database copy (what was done after the copy is
lost; the replaced database is kept aside as `rolled-back-<time>.db`), then:

- **Every unused sign-in link stops working.** Links are stored only as a
  keyed hash, under `Auth__TokenKey`; the script writes a new key, so no old
  link matches.
- **Everyone is signed out.** The script deletes the Data Protection keys
  folder. Session cookies and the antiforgery token are protected with those
  keys, so every cookie in every browser becomes unreadable. Sessions made
  after the copy are also gone with the restored database.

After it, ask people to request a new link; you can copy one from the People
screen. The scripts never print secrets.

**Where things are**

- Data, on the server: `/srv/idea-discovery/data` (owner uid 1654, mode 700,
  so use `sudo` to look): `idea-discovery.db` (the database), `keys/` (Data
  Protection keys), `backups/` (the pre-update and rolled-back copies).
- Certificates: a Docker volume, kept by Docker.
- Settings: `~/idea-discovery/.env`.

**Logs** (from `~/idea-discovery`): `docker compose logs --tail 100 api`, and
`docker compose logs --tail 100 web` for Caddy. Add `-f` to follow them live.
Docker keeps the last 30 MB per service. There is no log shipping.

**Stop or start:** `docker compose stop` and `docker compose up -d`. The
containers also restart by themselves after a server reboot.

## IPv6

We use IPv4 only for now, so `rooms.<domain>` has an A record and no AAAA
record, and compose publishes ports 80 and 443 on `0.0.0.0` only. Reason: with
Docker's default network, a visitor arriving over IPv6 reaches Caddy through
Docker's own proxy, so the app would see Docker's address instead of the
visitor's, and every IPv6 visitor would share one rate-limit bucket. IPv4
visitors keep their real address.

To use IPv6 later, enable IPv6 on the compose network (and Docker's IPv6
firewall support), publish on `[::]` too, add the AAAA record, and then check
(in the 9c deployment check) that a request from an IPv6 address appears in
the API's audit entries with that address, not a Docker one.

## 9. Before real owners: the release gate

This deployment holds **test participants and invented data only**. It has
no backups (only the two pre-update copies, which are not backups). Before
real business owners join (M4), these must exist:

- the privacy notice, naming Resend and, from M2, the AI provider;
- tested backups, and a tested restore, rolling off after 30 days;
- retention periods for session and audit IP addresses.

See the release-gate row in [decisions.md](decisions.md).
