# TabMail — Software Design Specification (SDS)

**Version:** 1.1
**Date:** February 2026
**Purpose:** Agent-executable specification for Claude Code + Conway Terminal

---

## 1. Project Overview

### 1.1 What Is This?

TabMail is a simple, non-commercial web app that lets friends and family search for guitar chord sheets/tabs, convert them to clean PDFs, and email them directly to a missionary who has email access but cannot browse the web.

This project is **not operated for profit**. There is no revenue, advertising, data collection, analytics, or tracking. It is a family project built with love, intended for a small private group of users.

### 1.2 Core User Stories

1. **Web UI (friends & family):** A user visits the app, enters a shared password, searches for a song, previews the chord sheet, and clicks "Send" to email it as a PDF to the missionary.
2. **Email-to-tab (missionary):** The missionary sends an email like `Subject: Foo Fighters - Everlong` to a dedicated address. The system finds the best chords, generates a PDF, and replies with it attached.

### 1.3 Users

- **Senders:** Friends and family (5–20 people) who use the web UI. Authenticated with a single shared password.
- **Recipient:** One person (the missionary son) whose email address is configured server-side.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Conway Cloud Sandbox                   │
│              (Small: 1 vCPU, 512MB RAM)                 │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Express.js  │  │  Tab Scraper │  │ PDF Generator │  │
│  │  Web Server  │──│  (Cheerio +  │──│   (PDFKit)    │  │
│  │  + Auth      │  │   axios)     │  │  No Chromium  │  │
│  └──────┬───────┘  └──────────────┘  └───────────────┘  │
│         │                                    │          │
│  ┌──────┴───────┐                   ┌────────┴───────┐  │
│  │  Static UI   │                   │  Email Sender  │  │
│  │ (HTML/CSS/JS)│                   │  (Nodemailer)  │  │
│  │  Dark Theme  │                   └────────────────┘  │
│  │  Mobile-1st  │                                       │
│  └──────────────┘                                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Inbound Email Handler (Mailgun Inbound Routes)  │   │
│  │  POST /api/inbound-email                         │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
         │
         │ Exposed via Conway port + custom subdomain
         ▼
┌─────────────────┐
│ tabmail.life.   │
│ conway.tech     │
└─────────────────┘
```

### 2.1 Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Hosting** | Conway Cloud Sandbox (Small — 1 vCPU, 512MB RAM) | Lightweight, no Chromium needed |
| **Domain** | Conway subdomain (`tabmail.life.conway.tech`) | Optional: Conway Domains for custom domain |
| **Runtime** | Node.js 20+ | Single process, Express server |
| **Web UI** | Vanilla HTML/CSS/JS | Dark theme, mobile-first, no framework |
| **Auth** | Shared password via express-session + cookie | bcrypt-hashed, server-side session |
| **Scraping** | Cheerio + axios | Primary source: guitartabs.cc |
| **PDF Generation** | PDFKit (pure Node.js) | No browser dependency — runs on 512MB RAM |
| **Outbound Email** | Nodemailer + Mailgun SMTP | Send PDFs as attachments |
| **Inbound Email** | Mailgun Inbound Routes → webhook POST | For the email-to-tab feature |
| **Process Manager** | pm2 | Keep the server running on the sandbox |

### 2.2 Key Design Decisions (v1.1)

- **PDFKit over Puppeteer:** Puppeteer requires headless Chromium (~300MB+ RAM). PDFKit is pure Node.js, generates clean PDFs with zero native dependencies, and runs comfortably on a Small sandbox.
- **guitartabs.cc over Ultimate Guitar:** UG uses aggressive Cloudflare protection that blocks server-side requests. guitartabs.cc serves the same chord content without anti-bot measures and has a straightforward HTML structure for scraping.
- **Dark theme:** Better for the typical use case (quick phone lookup), easier on the eyes, modern look.
- **Terms of Use page:** Provides transparency about non-commercial nature, fair use, and data practices. Linked from every page for anyone who discovers the site.

---

## 3. Detailed Feature Specifications

### 3.1 Web UI — Search & Send Tabs

#### 3.1.1 Login Page (`GET /`)

- Simple centered form: one password input, one "Enter" button
- On submit, `POST /auth` with the password
- If password matches `SHARED_PASSWORD` env var (bcrypt-hashed), set a session cookie and redirect to `/search`
- If wrong, show inline error "Wrong password, try again"
- Session expires after 7 days
- Dark theme, mobile-first — 16px font-size inputs prevent iOS zoom
- Footer link to Terms of Use & Transparency page

#### 3.1.2 Search Page (`GET /search`)

- **Requires auth** (redirect to `/` if no session)
- Input field: "Search for a song..." with placeholder text like `Foo Fighters - Everlong`
- "Search" button
- On submit, `POST /api/search` with the query string
- Display results as a list of cards showing:
  - Song title
  - Artist
  - Type badge (chords vs tab)
  - "Preview" button
  - "Send" button
- Footer with Terms link and "Non-commercial project for missionaries" text

#### 3.1.3 Preview Modal

- When "Preview" is clicked, fetch the chord sheet content and display in a bottom-sheet style modal (mobile) or centered modal (desktop)
- Render with monospace font (`Courier New`) to preserve chord alignment
- Show metadata (key, capo, tuning) when available
- "Send as PDF" button inside the preview
- "Close" button
- Safe area padding for phones with home bars

#### 3.1.4 Send Flow

1. User clicks "Send"
2. Button shows "Sending..." loading state
3. Backend: fetch full chord sheet → generate PDF via PDFKit → email via Nodemailer/Mailgun
4. On success: show toast notification "Sent [Song Title] by [Artist]!"
5. On failure: show error toast with message

#### 3.1.5 UI Design Notes

- **Mobile-first.** Most friends/family will use this on their phones.
- **Dark theme.** Dark background (#0f0f0f), light text (#e5e5e5), blue accent (#3b82f6).
- **Minimal and fast.** No SPA framework. Static HTML with vanilla JS for search/preview interactions.
- **Touch-friendly.** Large tap targets (14px+ padding on buttons), `touch-action: manipulation` to prevent double-tap zoom.
- **iOS-safe.** 16px font-size on inputs (prevents auto-zoom), `100dvh` for proper viewport handling, `env(safe-area-inset-bottom)` for home bar.

#### 3.1.6 Terms of Use Page (`GET /terms`)

- Public page (no auth required) — accessible from login and search pages
- Covers: what TabMail is, non-commercial nature, how it works, chord sheet sourcing, data/privacy (no tracking, no database, no accounts), fair use, no warranty, contact info
- Provides transparency for anyone who discovers the site

### 3.2 Email-to-Tab (Inbound Email)

#### 3.2.1 How It Works

1. Missionary sends email to `tabs@tabmail.xyz` (or whatever domain is registered)
2. Mailgun receives the email, parses it, and POSTs to `https://tabmail.xyz/api/inbound-email`
3. Server extracts the subject line as the search query (e.g., `Foo Fighters - Everlong`)
4. Runs the same search → pick best result → generate PDF → reply to sender with PDF attached
5. If no results found, reply with a friendly "Couldn't find that song, try a different title or artist"

#### 3.2.2 Inbound Email Payload (Mailgun)

Mailgun sends a multipart POST with fields including:
- `sender` — verify it matches an allowlist (missionary's email)
- `subject` — used as the search query
- `stripped-text` — body text (can be used as fallback query or for additional instructions)

#### 3.2.3 Security

- Only process emails from a configured allowlist of sender addresses (`ALLOWED_SENDERS` env var)
- Rate limit: max 10 requests per hour per sender
- Ignore emails with empty subjects

### 3.3 Tab Scraping Engine

#### 3.3.1 Search (`searchTabs(query)`)

```
Input:  "Foo Fighters - Everlong"
Output: [
  {
    title: "Everlong",
    artist: "Foo Fighters",
    url: "https://www.guitartabs.cc/tabs/f/foo_fighters/everlong_crd.html",
    type: "chords",       // "chords" | "tab"
    rating: 0,
    votes: 0,
    source: "guitartabs.cc"
  },
  ...
]
```

**Strategy:**
1. **Primary source:** guitartabs.cc — search with `band` and `song` parameters, parse result links
2. **Query parsing:** Split "Artist - Song" format automatically; fall back to song-only search
3. Sort results with "chords" type first (more useful for casual players), then "tab"
4. Filter out bass tabs and drum tabs

#### 3.3.2 Fetch Chord Sheet (`fetchChordSheet(url)`)

```
Input:  "https://www.guitartabs.cc/tabs/f/foo_fighters/everlong_crd.html"
Output: {
  title: "Everlong",
  artist: "Foo Fighters",
  capo: "none",
  tuning: "Drop D (DADGBe = low E string down 2 steps)",
  key: "",
  content: "Everlong — Foo Fighters (Chords, Tabs + Lyrics)\n\n...",
  source: "guitartabs.cc"
}
```

**Notes:**
- Content is extracted from `div.tabcont` → innermost `div` on guitartabs.cc
- Capo and tuning are auto-detected from the chord sheet content via regex
- Handle rate limiting: add 0.5–1.5 second random delays between requests, rotate User-Agent strings
- Cache results for 24 hours to reduce scraping load (simple in-memory cache)

#### 3.3.3 Anti-Scraping Considerations

- Use realistic User-Agent headers (rotated from a pool of 3)
- Add random delays (0.5–1.5 seconds) between fetch requests
- Cache aggressively — most chord sheets don't change
- This is for personal/family use with very low volume (~5-20 requests/day)

### 3.4 PDF Generation

#### 3.4.1 PDF Layout

Generate a clean, printable chord sheet PDF using **PDFKit** (pure Node.js, no browser):

```
┌─────────────────────────────────┐
│  EVERLONG                       │  ← Song title (20pt Helvetica-Bold)
│  Foo Fighters                   │  ← Artist (14pt Helvetica)
│  Tuning: Drop D                 │  ← Metadata (10pt Helvetica-Oblique)
│─────────────────────────────────│
│                                 │
│  [Intro]                        │  ← Section headers (11pt Helvetica-Bold, blue)
│  Dsus2  Bsus2  Gsus2  Dsus2    │  ← Chords (10pt Courier-Bold, blue)
│                                 │
│  [Verse 1]                      │
│  Dsus2              Bsus2       │  ← Chords above lyrics
│  Hello, I've waited here for    │  ← Lyrics (10pt Courier)
│  Gsus2                          │
│  you, Everlong                  │
│                                 │
│─────────────────────────────────│
│  Sent via TabMail — non-        │  ← Footer (8pt, gray)
│  commercial, personal use       │
└─────────────────────────────────┘
```

**Implementation:**
1. PDFKit generates the PDF entirely in Node.js — no headless browser needed
2. Chord lines detected via heuristic (>50% of tokens match chord pattern)
3. Section headers (`[Verse]`, `[Chorus]`, etc.) rendered in blue bold
4. Monospace font (`Courier` / `Courier-Bold`) for chord alignment
5. Page size: US Letter (8.5" x 11")
6. Margins: 0.75" all sides (54pt)
7. Auto-pagination when content exceeds page bottom

#### 3.4.2 PDF Filename

Format: `Artist - Title.pdf`
Example: `Foo Fighters - Everlong.pdf`

### 3.5 Email Sending

#### 3.5.1 Outbound Email Format

```
From:    TabMail <noreply@tabmail.xyz>
To:      [missionary email]
Subject: New tab: Everlong — Foo Fighters
Body:    Hey [name]! Someone sent you guitar chords for "Everlong" by Foo Fighters.
         Grab your guitar and enjoy!
Attach:  Foo Fighters - Everlong.pdf
Footer:  Sent via TabMail — a non-commercial project for missionaries
```

#### 3.5.2 Email Configuration

Use **Mailgun** (recommended — handles both inbound and outbound):
- SMTP host: `smtp.mailgun.org` port 587
- Auth: `postmaster@{MAILGUN_DOMAIN}` / `{MAILGUN_API_KEY}`

---

## 4. Project Structure

```
tabmail/
├── server.js                 # Express app entry point (with transparency header comment)
├── package.json
├── .env                      # Environment variables (not committed)
├── .env.example              # Template for env vars
│
├── lib/
│   ├── scraper.js            # searchTabs() and fetchChordSheet() — guitartabs.cc
│   ├── pdf.js                # generatePDF(chordSheet) → Buffer via PDFKit
│   ├── email.js              # sendTabEmail(pdf, songInfo) via Mailgun SMTP
│   └── cache.js              # Simple in-memory cache with 24hr TTL
│
├── routes/
│   ├── auth.js               # POST /auth (bcrypt), GET /logout
│   ├── api.js                # POST /api/search, /api/preview, /api/send, /api/inbound-email
│   └── pages.js              # GET /, GET /search, GET /terms
│
├── public/
│   ├── style.css             # Dark theme, mobile-first styles
│   └── app.js                # Client-side JS (search, preview modal, send, toast)
│
└── views/
    ├── login.html            # Password entry page + terms link
    ├── search.html           # Search + results + preview modal + footer
    └── terms.html            # Terms of Use & Transparency page
```

---

## 5. Environment Variables

```bash
# Auth
SHARED_PASSWORD=your_shared_password_here

# Recipient
MISSIONARY_NAME=YourSonsName
MISSIONARY_EMAIL=son@example.com

# Email sending (Mailgun)
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=tabmail.xyz

# Email inbound
ALLOWED_SENDERS=son@example.com,anotheremail@example.com

# App
PORT=3000
SESSION_SECRET=random_secret_string_here
NODE_ENV=production
```

---

## 6. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/` | No | Login page |
| `POST` | `/auth` | No | Authenticate with shared password |
| `GET` | `/logout` | No | Clear session, redirect to `/` |
| `GET` | `/search` | Yes | Main search page |
| `GET` | `/terms` | No | Terms of Use & Transparency page |
| `POST` | `/api/search` | Yes | Search for tabs. Body: `{ "query": "..." }`. Returns array of results. |
| `POST` | `/api/preview` | Yes | Fetch chord sheet for preview. Body: `{ "url": "..." }`. Returns sheet object. |
| `POST` | `/api/send` | Yes | Generate PDF and email it. Body: `{ "url": "...", "title": "...", "artist": "..." }` |
| `POST` | `/api/inbound-email` | Mailgun webhook | Webhook for inbound emails. Processes subject as search query. |
| `GET` | `/api/health` | No | Health check (returns `{ "status": "ok" }`) |

---

## 7. Conway Deployment Instructions

These are the steps for Claude Code with Conway Terminal to deploy the app.

### 7.1 Create Sandbox

```
Create a Conway Cloud sandbox — Small tier (1 vCPU, 512MB RAM, 5GB disk).
PDFKit is pure Node.js, so no Chromium or extra memory is needed.
```

### 7.2 Setup the Sandbox

```bash
# No system dependencies needed — PDFKit has no native deps

# Create the project directory
mkdir -p /app/tabmail && cd /app/tabmail

# Initialize and install dependencies
npm init -y
npm install express express-session cheerio axios pdfkit nodemailer dotenv express-rate-limit bcryptjs
npm install -g pm2
```

### 7.3 Deploy and Expose

```
1. Write all application files to /app/tabmail/
2. Create the .env file with the user's configuration
3. Start the app with pm2: `pm2 start server.js --name tabmail`
4. Expose port 3000 via Conway Cloud with a custom subdomain (e.g., tabmail.life.conway.tech)
5. Optionally: register a custom domain via Conway Domains and point it to the sandbox
```

### 7.4 Configure Inbound Email (Mailgun)

```
1. Add the domain to Mailgun (verify DNS)
2. Set up MX records via Conway Domains DNS management (or domain registrar)
3. Create an inbound route in Mailgun:
   - Match: catch_all()
   - Action: forward("https://tabmail.life.conway.tech/api/inbound-email")
4. Verify the route is working by sending a test email
```

---

## 8. Security Considerations

- **Shared password** is stored hashed (bcrypt) server-side. Hash generated lazily on first request.
- **Sessions** use `express-session` with a secure secret, httpOnly cookies, and sameSite lax.
- **Proxy trust** enabled (`trust proxy: 1`) since app runs behind Conway's reverse proxy.
- **Rate limiting:** `express-rate-limit` — 30 searches/hour per IP, 10 sends/hour per IP.
- **No database.** No user data stored. Cache is ephemeral (in-memory, clears on restart).
- **No tracking.** No analytics, no third-party scripts, no cookies beyond the session cookie.
- **HTTPS** is handled by Conway's port exposure (TLS by default).
- **Transparency:** Terms of Use page linked from every page explains non-commercial nature and data practices.

---

## 9. Error Handling

| Scenario | Behavior |
|----------|----------|
| Song not found | Show "No results found, try different search terms" |
| Scraping blocked/fails | Log error, show "Search failed, please try again" |
| PDF generation fails | Log error, show "Failed to generate or send PDF" |
| Email send fails | Log error, show error toast with message |
| Inbound email — bad sender | Silently ignore (don't reply to unknown senders) |
| Inbound email — no results | Reply with friendly "Couldn't find that song" message |
| Rate limit exceeded | Return 429 with "Too many requests, try again later" |

---

## 10. Legal & Transparency

TabMail includes a public Terms of Use & Transparency page (`/terms`) that covers:

- **What it is:** Non-commercial, personal-use family tool
- **Non-profit disclosure:** No revenue, advertising, data collection, or tracking
- **Chord sheet sourcing:** Fetched from publicly available websites; not permanently stored or redistributed; all content belongs to respective authors
- **Data & privacy:** No accounts, no database, no tracking, no third-party scripts
- **Fair use:** Personal, non-commercial use at minimal scale
- **No warranty:** Provided as-is
- **Contact:** Instructions for rights holders with concerns

All source files include header comments explaining the non-commercial, personal-use nature of the project.

---

## 11. Future Enhancements (Out of Scope for V1)

- **Song request history:** Show what's been sent so people don't send duplicates
- **Favorites/queue:** Let the missionary build a wishlist via email
- **Multiple recipients:** Support more than one missionary
- **Transpose chords:** Let sender pick a different key before sending
- **ChordPro import:** Paste or upload .chordpro files and generate PDFs
- **Setlist builder:** Combine multiple songs into one multi-page PDF
- **Additional tab sources:** Add more fallback scrapers if guitartabs.cc goes down

---

## 12. Summary for the Agent

**Your job:** Build and deploy a Node.js web app on Conway Cloud that:

1. Serves a password-protected, dark-themed, mobile-first web UI where users search for guitar chords
2. Scrapes chord sheets from guitartabs.cc (Cheerio + axios)
3. Renders them as clean, printable PDFs using PDFKit (no Chromium needed)
4. Emails the PDF to a configured recipient via Mailgun SMTP / Nodemailer
5. Accepts inbound emails as song requests and auto-replies with the PDF
6. Is deployed on a Conway Cloud sandbox (Small tier) with a public URL
7. Includes a Terms of Use & Transparency page for legal/ethical clarity

**Keep it simple.** This is a non-commercial, personal tool for one family. No database, no user accounts, no analytics. Just search → PDF → email. Make it work, make it clean, make it fast.
