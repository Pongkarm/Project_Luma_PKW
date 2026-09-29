# LUMA Frontend (Node 1)

The user-facing web application for Project LUMA. It talks to the **backend (Node 2)**
and only to the backend — the browser never reaches the AI inference node.

Built with Vite + React + TypeScript. No UI framework: the design system is ~600 lines
of CSS driven by tokens.

---

## Running it

```bash
npm install
cp .env.example .env      # point VITE_API_BASE_URL at your backend
npm run dev               # http://localhost:5173
```

| Script | Does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check (`tsc -b`) then production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | oxlint |
| `npm run check` | Everything above plus stylelint and the tests — run this before a commit |

`VITE_API_BASE_URL` is the **only** place the backend's origin is written down. The dev server
restarts by itself when `.env` changes. To try another backend without touching the file, set
it for one run — a value given this way wins over `.env` for as long as that server runs:

```bash
VITE_API_BASE_URL=http://localhost:8000 npm run dev
```

## Connecting to a backend

The top bar says **Online** when the backend answered, **Backend unreachable** when it did not.
Before blaming the frontend, ask the backend directly from the same machine:

```bash
curl http://<backend-ip>:8000/healthz
# {"status":"healthy", ..., "database":"connected"}
```

If that fails, the problem is between the two machines, not in this app.

### Another teammate's backend on the same network

1. **Find the backend machine's current IP** on that machine. It changes whenever the Wi-Fi or
   hotspot changes, which is the usual reason a working setup stops working:
   `ipconfig getifaddr en0` on macOS, `ipconfig` on Windows (the IPv4 address).
2. **The backend has to listen on the network, not just on itself.** Plain
   `uvicorn main:app` binds to `127.0.0.1` and nobody else can reach it; start it with
   `--host 0.0.0.0`, as the backend README does. A firewall prompt on Windows has to be allowed.
3. Put `http://<that-ip>:8000` in `.env`.

CORS needs nothing: the backend allows every origin.

### The whole stack on one machine

For working on the frontend without a teammate's machine, run the backend yourself against
`mock_ai_server.py`, which stands in for the GPU node and returns a placeholder image.

```bash
git clone -b backend https://github.com/Pongkarm/Project_Luma_PKW.git ~/luma-backend
cd ~/luma-backend
uv venv -p 3.10 .venv        # 3.10 like the Dockerfile — mediapipe 0.10.14 will not install above 3.12
uv pip install -p .venv/bin/python -r requirements.txt

# PostgreSQL on 5433, kept inside the clone
initdb -D ./pgdata -U luma -A trust
pg_ctl -D ./pgdata -o "-p 5433" -l pg.log start
createdb -h localhost -p 5433 -U luma luma_db

cp .env.example .env
```

In the backend's `.env`, set `DATABASE_URL=postgresql://luma@localhost:5433/luma_db`, and give
`SECRET_KEY` and `AI_CALLBACK_SECRET` each a fresh value from
`python3 -c "import secrets; print(secrets.token_urlsafe(64))"` — the backend refuses to start
with a placeholder, a secret under 32 characters, or one that has leaked before.
`ADMIN_BOOTSTRAP_EMAIL` makes the account with that email the first owner once it registers
and the backend restarts.

Then, in three terminals:

```bash
cd ~/luma-backend && .venv/bin/python -m uvicorn mock_ai_server:app --port 8001   # fake AI node
cd ~/luma-backend && .venv/bin/python -m uvicorn main:app --port 8000             # backend
VITE_API_BASE_URL=http://localhost:8000 npm run dev                                # this app
```

A new database has no accounts; register one from the sign-in page. After `git pull` on the
backend, run the `uv pip install` line again if `requirements.txt` changed.

### When it does not connect

| You see | Usually means |
|---|---|
| **Backend unreachable**, and `curl …/healthz` fails too | Wrong or stale IP, backend bound to `127.0.0.1`, or a firewall |
| **Backend unreachable**, but `curl` works | `npm run dev` was started with `VITE_API_BASE_URL=…` in front, which overrides `.env` |
| The session-expired dialog straight after switching backends | The saved token was signed by the other backend's `SECRET_KEY` — sign in again |
| The studio says its tools are not on this server | That backend predates `/api/tools` (`37d1196`); pull `origin/backend` |
| The backend will not start: secret rejected | `SECRET_KEY` / `AI_CALLBACK_SECRET` still the example value or too short |
| `pip install` fails on `mediapipe` | Python newer than 3.12; make the venv with 3.10 |

---

## What it does

**Generate** — one workspace, three modes, sharing a prompt and a settings panel:

- **Text to image** — prompt, model, size, seed
- **Image to image** — drag-and-drop upload with real progress, replace/remove, change amount
- **Inpaint** — brush/eraser mask painting with undo, redo, clear, mask-only preview, and
  keyboard shortcuts (`B` `E` `[` `]` `⌘Z`)

**Size** — three aspect-ratio presets plus custom width and height, each with a slider and a
typed field, a live shape preview, swap orientation, lock aspect ratio, and reset. Everything is
clamped to what the engine accepts and snapped to multiples of 8.

**Saved settings** — name a combination of size, model, style and technical values and apply it
again from the sidebar. Kept on the device; nothing appears in the interface until the first one
is saved.

**History** — paginated runs with status, full parameters, prompt copying, full-size viewing,
and deletion. A run that has not finished can be stopped from the stage; the record is kept.

**Studio** (`/studio`) — four image tools from the backend's `/api/tools`: pencil sketch,
colour splash (keep green or red), pose landmarks and background removal. Each result becomes
a new version in a strip along the bottom, so any earlier step is one tap away; a before/after
slider compares a version with the one it was made from. A cut-out's mask can be taken straight
to Inpaint with the background (or the subject) already painted. Versions live in memory only
and the page says so — save one, or use it as a source, to keep it.

**Quick edit** — the same four tools under every finished result, one click each with default
settings, changing the picture in place. It shares the studio's versions, so "More in Studio"
carries on from where the bar left off.

**Account** — profile with editing (username, email, password), theme, language, sign out.

**Both languages** — the whole interface in English and Thai, switchable from the top bar or
Account. Prompt text stays English; see the note below.

`⌘↵` generates from anywhere. Clicking any finished image opens it full size.

## How it is put together

```text
frontend/
  src/                the app — everything below
  tools/              browser checks (headless Chrome sweeps), see tools/README.md
  index.html, *.config.ts, tsconfig*.json, package.json   build and tool settings
  dist/, node_modules/                                     generated; not in git

src/
  main.tsx      entry point: loads the stylesheets, mounts <App />
  app/          routes, guards, error boundary, query client
  config/       base URL, parameter limits, model list, polling, i18n dictionary
  contracts/    request/response types mirrored from the backend's Pydantic schemas
  services/     apiClient + auth · user · upload · generation · tools · system · admin
  shared/
    ui/         buttons, fields, sliders, dialogs, drop zone, icons, image viewer
    hooks/      translation, media queries, authed images, page title, timers
    stores/     preferences (theme, language, panel state)
    styles/     tokens.css · base.css · ui.css · layout.css · studio.css
    utils/      formatting, JWT expiry
  features/     one folder per page or area
    auth/       sign-in, register, session store, expired-session dialog
    generate/   workspace shell, mode fields, upload/, canvas/ (mask), run/ (result stage)
    studio/     the studio page, tool panel, versions, compare, quick-edit bar
    history/    list, run detail
    account/    profile
    admin/      admin console: overview, users, audit, roles
    layout/     app shell, rail, tab bar, engine indicator
  __tests__/    unit tests (vitest), one file per area
```

### Where to look

| To change… | Look in |
|---|---|
| Any text on screen, in either language | `src/config/i18n.ts` — both languages side by side |
| A limit (prompt length, steps, sizes, sketch line softness) | `src/config/limits.ts` |
| What a request sends or a response contains | `src/contracts/` — the field names live only here |
| How an endpoint is called | `src/services/` — one file per area of the API |
| A page | `src/features/<page>/` — the page file is named after it (`StudioPage.tsx`, …) |
| Something shared by several pages (a button, the drop zone) | `src/shared/ui/` |
| Colours, spacing, fonts | `src/shared/styles/tokens.css` |
| Layout of the shell, the Generate page or History | `src/shared/styles/layout.css` |
| Layout of the studio or the quick-edit bar | `src/shared/styles/studio.css` |
| The backend's address | `.env` → `VITE_API_BASE_URL` |
| A test | `src/__tests__/` — `studio.test.ts`, `tools.test.ts`, … |

Two decisions worth knowing:

- **`contracts/` is separate from `services/`.** Every field name and enum the API uses has
  exactly one definition in the frontend. When the backend changes a field, the diff lands in
  one folder and TypeScript points at every screen that needs attention. No component ever
  writes an endpoint string.
- **The mask canvas is its own module.** It is the heaviest, least portable part of the app —
  pointer handling, an undo stack, an export step — so it stays isolated and is not offered at
  all below 768px, where a mask cannot be painted accurately.

### Where state lives

| Owner | Holds | Survives |
|---|---|---|
| URL | route, selected run | reload, sharing |
| Session store | token, current user | reload |
| Draft store | prompt, settings, uploaded image | reload, failed run, expired session |
| Server cache (TanStack Query) | runs, job status, profile | nothing |
| Preferences | theme, last mode, panel state, model | per device, forever |
| Studio store | the studio's versions (images in memory) | moving between pages, not a reload |
| Mask hand-off | a cut-out's mask on its way to the Inpaint canvas | until the canvas takes it |

Authentication never lives in a component. One store owns the token, one interceptor turns a
401 into the expired-session dialog, and one guard decides what a signed-out visitor may see.

---

## Languages

All interface copy lives in `src/config/i18n.ts` — one typed dictionary, English and Thai, read
through the `useT()` hook. Thai is written the way a Thai person would say it rather than
translated word by word, and Thai typography (line height, word breaking) is handled in
`base.css` under `:root[lang='th']` without affecting the Latin layout.

A key present in English but missing in Thai falls back to English rather than showing the key,
so a missed string degrades quietly. To check both sides are complete:

```bash
node -e "const s=require('fs').readFileSync('src/config/i18n.ts','utf8');
const k=x=>new Set([...x.matchAll(/^\s{4}'([a-z]+\.[A-Za-z0-9]+)':/gm)].map(m=>m[1]));
const en=k(s.slice(s.indexOf('  en: {'),s.indexOf('  th: {'))), th=k(s.slice(s.indexOf('  th: {')));
console.log(en.size, th.size, [...en].filter(x=>!th.has(x)));"
```

**Prompts are deliberately not localized.** The image model reads English only — Stable
Diffusion's text encoder has no Thai in its vocabulary, so a Thai prompt becomes noise and
produces an unrelated image. Prompt examples and placeholders stay English until the team
decides how a translation step should work, which would have to live in the AI node.

## Backend endpoints this build expects

All of these are on `origin/backend` — the first five since 7 Sep 2026, the tools since
28 Sep (`37d1196`), in their current form since 29 Sep (`f8312a5`).

| Endpoint | Used for |
|---|---|
| `GET /api/models` | Real checkpoint and LoRA lists from the AI node |
| `DELETE /generations/{id}` | Removing an image and its record |
| `POST /generations/{id}/cancel` | Stopping a run that has not finished |
| `GET /generations/{id}/progress` | Queue position and live step count, proxied from the AI node |
| `PATCH /auth/me` | Changing username, email or password |
| `POST /api/tools/{sketch,color-splash,pose,remove-bg}` | The studio and the quick-edit bar; the image always goes as the multipart `file` |
| `GET /api/tools/results/{filename}` | Fetching a tool's output |

What the tools accept, as of `f8312a5`:

- **The image only as `file`.** `image_url` was removed — it let a signed-in user make the
  server read any file on its disk. This app never sent it.
- **At most 10 MB and 4096 px on the long side**, or 413. The upload limits in
  `config/limits.ts` are the same numbers.
- **`blur_ksize` 3–51** (an even value is rounded up) and **`target_color` `green` or `red`**,
  or 422. The sketch slider keeps to 15–31, inside that range.
- **Two tools at a time** run in a worker pool beside the server, so one cut-out no longer
  stalls every other request. A cut-out of a 512 px image takes about 0.2 s; one that runs past
  60 s answers 504.
- When the backend starts, it deletes tool results older than 24 hours. Save anything worth
  keeping.

Each still degrades rather than breaking when absent: the model pickers fall back to the
bundled list, and delete or profile changes report the failure instead of appearing to succeed.
A 404 from the tools says the studio is not on that server yet, as a note rather than an error.
That behaviour is worth keeping — it is what let this build ship against a backend that did
not have them yet.

## Admin console

A separate surface at `/admin`, for the people who run the system rather than
use it. Three roles, and a role is a row in `admin_roles` rather than a column
on `users` — the backend has no migrations, and `create_all()` creates tables
it has never seen but never alters ones it has, so a column would mean running
`ALTER TABLE` by hand against the live database.

| Role | May |
|---|---|
| `reviewer` | Read everything, with emails masked and prompts withheld |
| `admin` | The above, plus disable/enable accounts and read the audit log |
| `owner` | The above, plus grant and revoke roles |

The first owner comes from `ADMIN_BOOTSTRAP_EMAIL`, read once at startup and
ignored thereafter. The role is looked up per request rather than signed into
the token, so revoking one takes effect immediately instead of whenever the
token expires.

**The route guard is not the security boundary.** `/admin` refuses at the API;
the sidebar simply avoids showing a control that would be refused. Typing the
URL gets a 403 from the server, not a component that declines to render.

Four things an admin deliberately cannot do, all enforced server-side:

- change another user's email or password — that is an account-takeover path,
  since whoever holds the address can request a reset
- disable their own account
- disable an owner
- remove the last owner, which would leave nobody able to grant the role back

Every change writes an `audit_events` row in the same transaction, so an action
cannot succeed unlogged, and nothing anywhere updates or deletes those rows.

## Checks

```bash
npm run check     # build + lint + lint:css + test, in that order
```

Individually: `npm run build` (tsc + vite), `npm run lint` (oxlint — five known
warnings, zero errors), `npm run lint:css` (stylelint), `npm test` (vitest).

The CSS linter earns its place: a `@media` block in `layout.css` was missing its
closing brace and had silently swallowed seventeen rules that were written for
every screen, so they only applied below 520px. Nothing else in the toolchain
noticed — the stylesheet still parsed, it just meant something different.

The tests cover the logic that has actually broken here rather than aiming at a
coverage number: engine limits and dimension snapping, which caused a real 422;
the callback-mode field mirror; dictionary parity between the two languages,
which used to be checked by hand after every copy change; date and duration
formatting; the password rules; and, for the studio, the checks on tool result URLs before
a token is sent to them, the odd-only sketch kernel, the mask conversion and the version store.

## Notes on the API this was built against

Everything below was verified against a running backend, not read from documentation.

**Things the frontend has to work around**

- `POST /auth/login` is an OAuth2 password form — `application/x-www-form-urlencoded`, not
  JSON. `authService` is the only code that knows this.
- `GET /generations/{id}/image` requires the bearer token, so it cannot be an `<img src>`.
  Images are fetched as blobs and shown from object URLs, which is why results and thumbnails
  appear a beat after the record does.
- `GET /uploads/{filename}` and its `HEAD` are behind the token as of 7 Sep 2026. They were
  world-readable, so uploaded images were shown with a plain `<img src>`; that now answers 401,
  and every one of them — the upload preview, the inpaint canvas, the stage, the history
  thumbnail — goes through `useUploadedImage()` instead. A browser will not attach an
  Authorization header to an image request, so there is no shorter way.
- `lora_config` is typed `Any` at every hop as of 7 Sep 2026. It used to be `Dict` on the
  backend and `List` on `mock_ai_server.py`, which meant no payload could satisfy both and
  choosing a style adapter failed against the mock. The UI sends an object either way.
- The AI node reads only the **first** LoRA it is given, so the picker is single-choice.
- There is no logout endpoint and no refresh token. Signing out is local; a long session ends
  with a re-entry, not a silent renewal.
- `/healthz` and `/api/status` used to return **500** — `main.py` read `settings.…` without
  importing it — and `requirements.txt` was missing **`passlib`**. Both were fixed upstream on
  7 Sep 2026. `systemService` still falls back to `GET /` when the detailed endpoints cannot
  answer, which is what makes a half-configured node report as degraded rather than dead.

**Things the API cannot do yet, and are therefore not drawn**

- Progress is drawn only when the engine measured it. `GET /generations/{id}/progress`
  answers 200 whether or not the AI node was reachable — in direct mode there is no queue
  to ask at all — and `live` says which happened. When it is false every metric is null and
  the stage keeps the indeterminate bar it always showed. This was worth insisting on: the
  first version of the endpoint filled the gap in from the database with a flat `0.5` for
  anything processing and a queue of one holding this job, with nothing marking them as
  placeholders, which would have drawn a bar frozen at half for every direct-mode run.
- No history filters. `GET /generations` takes only `page` and `page_size`.
- The seed actually used is returned in callback mode and persisted, but not in direct mode,
  where a random seed stays null. The run detail still says "seed sent" rather than "seed
  used" because only one of the two modes can honestly claim the latter.
- Cancelling has no status of its own: the row becomes `failed` with `error_message`
  exactly `Cancelled by user`. `wasCancelled()` in `contracts/` is the single place that
  knows this, so the stage can say "you stopped this run" instead of reporting an engine
  error the person should retry.

### Parameter limits

The backend and the AI node disagree, and the backend is the more permissive of the two — it
accepts jobs the AI node then rejects at inference time. `src/config/limits.ts` enforces the
narrower value of each pair and records where both come from:

| | backend | AI node | enforced |
|---|---|---|---|
| steps | 1–150 | 1–50 | **1–50** |
| cfg_scale | 0–30 | 1–20 | **1–20** |
| width/height | 64–2048 | 256–768 | **256–768** |
| prompt | 2000 chars | 500 chars | **500** |

When the two are reconciled upstream, that file is the only thing to change.

### Mode-sensitive controls

A small amber dot marks values that reach the engine in **direct** mode only. In `callback`
mode the backend drops `seed`, `sampler_name`, `lora_config` and `denoising_strength` before
dispatching, and for img2img/inpaint also `negative_prompt`, `model_name`, `width` and
`height`. The controls are marked rather than removed because the demo runs in direct mode; if
the project settles on callback, they should be hidden rather than left to do nothing quietly.

---

## Accessibility

Semantic controls throughout (native `<input type="range">` for sliders, real labels on every
field, `role="tab"` on the mode switch, `aria-live` error messages). One focus treatment —
a 2px accent ring, offset, drawn outside the control so nothing shifts. Status is never colour
alone: every state carries an icon and a word. Touch targets are 44px minimum on phones.

## Responsive

Desktop is the three-column shape. Below 1100px the controls become a sheet under the stage,
because a 372px panel and a usable image cannot both fit. Below 768px the rail becomes a tab
bar and inpaint reports that it needs a larger screen instead of opening a canvas nobody can
be accurate on.

The studio follows the same rule on a phone: the tool panel is a shorter sheet so the picture
stays visible, the version strip stays (it is the studio's undo), and the hand-off to Inpaint is
offered but disabled with the reason shown. Its own small controls — the splash swatches, the
quick-edit buttons — grow to at least a 36px hit area below 768px.
