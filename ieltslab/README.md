# IELTSLab — IELTS-style practice tests

IELTSLab is a complete practice-test website for the four IELTS skills — **Listening, Reading, Writing and Speaking** — in both **Academic** and **General Training** formats. Content managers enter their own test material; candidates sit randomly assembled, timed tests and get a detailed results page. It ships with an original practice bank of 46 materials (at least two for every part of every skill, Academic and General Training), so it is usable straight away.

> **Not affiliated with IELTS.** IELTSLab is an independent practice tool. It is not connected to or endorsed by IELTS, the British Council, IDP: IELTS Australia or Cambridge University Press & Assessment. The bundled demo content is original material written for this project, not official IELTS content. Practice results are estimates, not official scores.

## Features

**Test taking**
- Full test (Listening → Reading → Writing → Speaking) or a single skill, Academic or General Training.
- Countdown timer per section with 10/5/1-minute announcements and automatic submission when time runs out.
- Question navigator with answered / unanswered / flagged states, previous/next, review screen, and confirmation before submitting.
- Automatic saving (debounced, retried when offline). Leave with **Save and exit** and resume later with the same questions, answers and remaining time.
- Reading: split passage/questions view, text highlighting, adjustable text size, paragraph labels for matching tasks.
- Question types: multiple choice, True/False/Not Given, Yes/No/Not Given, matching (headings, information, features) and completion with word limits.
- Listening: uploaded audio, linked audio, or the author's script read by browser text-to-speech (clearly labelled as a synthetic voice). **Exam conditions** (each part plays once, no pausing) or **practice mode** (pause, rewind, replay). Missing audio is shown as unavailable, never silently replaced.
- Writing: task prompt with chart image, distraction-free editor (spell-check off, as in the test), live word and paragraph count against the minimum.
- Speaking: microphone check with level meter and permission handling, Part 1/3 answer timers, Part 2 one-minute preparation with notes then a two-minute long turn, playback and re-record. A no-microphone mode keeps the timers.
- Dark/light theme (remembered), keyboard-friendly controls, visible focus, responsive layout down to phone width.

**Results**
- Listening/Reading auto-scored against the answer key (case, spacing and punctuation tolerant; accepted alternatives; word limits enforced), scaled to 40 questions and converted with approximate band tables.
- Answer-by-answer review with explanations, transcripts and passages, breakdown by part and by question type, and a study tip for the weakest type.
- Writing and Speaking are **never given an invented band**. A band appears only after a review, always labelled with its source: teacher review, self-assessment against the four public criteria, or optional AI feedback (Writing only, when configured).
- Overall band for full tests (average of four skills, rounded to the nearest half band).
- History with averages per skill, resume, and delete.

**Accounts**
- Email/password registration and sign-in (scrypt password hashing, HttpOnly session cookies, CSRF protection, rate limiting).
- Google sign-in (OAuth 2.0) when credentials are configured; otherwise the button explains what is missing.
- Guest sessions: start immediately; registering or signing in keeps the guest's tests.
- Account settings: name, target band, default test format, theme, password change, account deletion.
- Each user only sees their own attempts and recordings. Administrators can review other candidates' Writing and Speaking.

**Content management (administrators)**
- Create, edit, duplicate, activate/draft and delete materials for every skill and part, with validation and clear error messages.
- Audio and image upload (type and size checked), JSON bulk import with a per-item validation report, and a coverage table showing which parts have material.
- Random assembly rules: one active material per part, matching skill and test format, no repeats within an attempt, materials not seen in the candidate's last five attempts preferred, Speaking Part 3 linked to the Part 2 topic through `topic:` tags. The chosen content is snapshotted into the attempt, so reloads, resumes and later edits never change it.
- Review queue for submitted Writing and Speaking.
- Restore or remove the bundled original practice bank (marked “Demo”; written for this project, not copied from any published test).

## Tech stack

| Part | Choice |
| --- | --- |
| Frontend | React 19 + TypeScript, bundled with esbuild, hash routing, plain CSS with design tokens |
| Backend | Node.js 22 `node:http` server, written in TypeScript and run with `tsx` |
| Database | Built-in `node:sqlite` (no native modules); uploads stored on disk in `DATA_DIR` |
| Shared logic | `shared/` — types, validation, scoring, test assembly, demo content (used by both server and browser) |
| Tests | `node:test` — engine unit tests and an end-to-end API test that boots a real server |

If the app is opened without the server (for example the single-file demo page), it runs in **browser-only mode**: tests, content and recordings are stored in IndexedDB on that device, accounts are disabled, and a banner says so.

## Getting started

Requirements: **Node.js 22.13 or newer** (for built-in SQLite).

```bash
npm install
cp .env.example .env      # optional — everything has defaults
npm run dev               # http://localhost:8787 (rebuilds and restarts on change)
```

Production:

```bash
npm run build
npm start                 # serves the API and the built app on PORT (default 8787)
```

The **first account you register becomes an administrator** (set `FIRST_USER_ADMIN=false` and use `ADMIN_EMAILS` on a public server). Open **Content** in the header to manage materials.

Other commands:

```bash
npm test                  # unit + API tests
npm run typecheck         # TypeScript for the browser and the server
npm run build:demo        # dist-demo/ieltslab-demo.html — one self-contained page, browser-only mode
```

## Configuration

All settings are environment variables (or a `.env` file). See `.env.example`.

| Variable | Purpose |
| --- | --- |
| `PORT`, `HOST` | Where the server listens (default `8787`, `0.0.0.0`). |
| `PUBLIC_URL` | Public address, e.g. `https://ielts.example.com`. Used for Google redirects and secure cookies. |
| `DATA_DIR` | Folder for the SQLite database and uploaded files (default `./data`). Back this up. |
| `ADMIN_EMAILS` | Comma-separated emails that become administrators when they register. |
| `FIRST_USER_ADMIN` | `true` (default) makes the first registered account an admin if none exists. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Enable Google sign-in. |
| `ANTHROPIC_API_KEY`, `ASSESSMENT_MODEL` | Enable optional AI Writing feedback. |
| `SEED_DEMO` | `false` to skip adding the demo set on first start. |

### Google sign-in

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth client ID** of type **Web application**.
2. Add the authorised redirect URI `PUBLIC_URL/api/auth/google/callback`, e.g. `http://localhost:8787/api/auth/google/callback`.
3. Configure the OAuth consent screen with the `openid`, `email` and `profile` scopes.
4. Put the client ID and secret in `.env` and restart. The server log shows `Google sign-in: enabled`.

Without these values the Google button stays disabled and explains why; email sign-in keeps working.

### AI Writing feedback (optional)

Set `ANTHROPIC_API_KEY` (and optionally `ASSESSMENT_MODEL`). Candidates then see **Get AI feedback** on their Writing results. Each task is scored against the four criteria with a comment; the result is labelled "AI feedback", limited to 10 requests per user per day, and is replaced by any teacher review. Speaking has no automated scoring.

## Adding content

- **Forms:** Content → New material. Pick skill, part and test format, then add the passage, audio, prompt or questions. Validation explains anything missing.
- **Import:** Content → Import JSON. The page shows the file format and a copyable template. Items that fail validation are listed and skipped; new ids are generated so nothing is overwritten.
- **Audio:** MP3, WAV, OGG, M4A/AAC or WEBM up to 25 MB. **Images:** PNG, JPEG, WEBP or GIF up to 5 MB. Images need a text description for accessibility.
- Use only material you have the right to use. Do not upload copied tests from other websites or books.

## Scoring notes

- Listening and Reading: raw score → scaled to 40 → approximate band table (Listening, Academic Reading and General Training Reading tables are shown on the Scoring page). With fewer than 40 questions the estimate is less precise.
- Writing: each task band is the mean of its four criteria; Task 2 counts double.
- Overall: mean of the four skills, rounded to the nearest half band (.25 rounds up to .5, .75 up to the next band).
- Practice results are estimates and are labelled as such everywhere.

## Project layout

```
server/      HTTP server, auth (sessions, Google OAuth), SQLite, optional AI feedback
shared/      Types, constants, validation, scoring, test assembly, demo content
src/         React app (pages/, runner/ for the test UI, api/ server + browser-only clients)
scripts/     esbuild build and dev scripts
tests/       Unit and API tests
```

## Limitations

- Band conversion tables are approximations; official tables vary by test version.
- Speaking is recorded and reviewed by people; there is no automated speech scoring.
- Browser text-to-speech voices vary by browser and operating system and do not sound like real test recordings. Upload real recordings for serious practice.
- The server keeps rate-limit counters in memory; run one instance (or add a shared store) if you scale out.

---

## Hướng dẫn nhanh (Tiếng Việt)

**Chạy trên máy**

```bash
npm install
npm run dev        # mở http://localhost:8787
```

Tài khoản đăng ký đầu tiên sẽ là **quản trị viên** (vào mục **Content** để thêm đề). Cần Node.js 22.13 trở lên.

**Đưa lên GitHub**

1. Tạo repository mới (trống) trên GitHub, ví dụ `ieltslab`.
2. Trong thư mục dự án:

```bash
git remote add origin https://github.com/<tên-của-bạn>/ieltslab.git
git branch -M main
git push -u origin main
```

Dự án đã có sẵn commit đầu tiên. File `.env` (chứa khóa bí mật) và thư mục `data/` đã được loại khỏi git qua `.gitignore` — đừng đưa chúng lên GitHub.

**Đăng nhập Google:** tạo OAuth Client ID loại "Web application" trên Google Cloud Console, thêm redirect URI `http://localhost:8787/api/auth/google/callback`, rồi điền `GOOGLE_CLIENT_ID` và `GOOGLE_CLIENT_SECRET` vào file `.env`.

## License

MIT for the code. The demo test content is original and may be used with this project.
