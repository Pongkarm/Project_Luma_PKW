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

`VITE_API_BASE_URL` is the **only** place the backend's origin is written down:

```
VITE_API_BASE_URL=http://localhost:8000       # local backend
VITE_API_BASE_URL=http://192.168.1.20:8000    # the team's LAN node
```

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
and deletion.

**Account** — profile with editing (username, email, password), theme, language, sign out.

**Both languages** — the whole interface in English and Thai, switchable from the top bar or
Account. Prompt text stays English; see the note below.

`⌘↵` generates from anywhere. Clicking any finished image opens it full size.

## How it is put together

```text
src/
  app/          routes, guards, error boundary, query client
  config/       base URL, parameter limits, model list, polling, i18n dictionary
  contracts/    request/response types mirrored from the backend's Pydantic schemas
  services/     apiClient + auth · user · upload · generation · system
  shared/       tokens, primitives, hooks, formatting
  features/
    auth/       sign-in, register, session store, expired-session dialog
    generate/   workspace shell, mode fields, upload, canvas/, run/, presets
    history/    list, run detail
    account/
    layout/     app shell, rail, engine indicator
```

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

## Settings the backend may ignore

The backend does not forward the stored generation record to the AI node — it
builds a payload per `AI_MODE`, naming each field by hand. The `direct` branch
names every field. The `callback` branch does not, and anything it omits never
reaches the engine while the run still reports success.

| Task | Ignored under `callback` |
|---|---|
| txt2img | seed, sampler, style (LoRA) |
| img2img, inpaint | those three plus negative prompt, checkpoint, output size, change amount |

`src/features/generate/ineffective.ts` mirrors those two payloads. Controls it
names are disabled and badged rather than hidden — they work under `direct`, so
the value stays in the draft and returns when the mode changes. When the
backend does not report a mode, or is unreachable, nothing is disabled: the
panel keeps its amber "may depend on the mode" dot instead of claiming a
certainty it does not have.

Re-read `process_generation` in `app/services/generation.py` if the backend's
payloads change; nothing detects a drift automatically.

## Backend endpoints this build expects

Three of these do not exist on `origin/backend` yet. They live on branch **`feat/models-proxy`**
and must be merged and deployed before the features that use them work:

| Endpoint | Used for | Status |
|---|---|---|
| `GET /api/models` | Real checkpoint and LoRA lists from the AI node | on `feat/models-proxy` |
| `DELETE /generations/{id}` | Removing an image and its record | on `feat/models-proxy` |
| `PATCH /auth/me` | Changing username, email or password | on `feat/models-proxy` |

Each degrades rather than breaking when absent: the model pickers fall back to the bundled list,
and delete or profile changes report the failure instead of appearing to succeed.

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
formatting; and the password rules.

## Notes on the API this was built against

Everything below was verified against a running backend, not read from documentation.

**Things the frontend has to work around**

- `POST /auth/login` is an OAuth2 password form — `application/x-www-form-urlencoded`, not
  JSON. `authService` is the only code that knows this.
- `GET /generations/{id}/image` requires the bearer token, so it cannot be an `<img src>`.
  Images are fetched as blobs and shown from object URLs, which is why results and thumbnails
  appear a beat after the record does.
- `GET /uploads/{filename}` has **no authentication at all** — any uploaded image is readable
  by anyone who knows its filename. Worth raising with the backend owner.
- `lora_config` must be a JSON **object**. The backend types it as `Dict[str, Any]` and rejects
  an array with 422, though `HANDOFF.md` shows an array. Note that `mock_ai_server.py` types the
  same field as a **list** and rejects an object — so with the mock AI server no LoRA payload
  can satisfy both ends. The real AI node accepts either (`Optional[Any]`), so the object shape
  is correct against the real engine. Choosing a style adapter will fail against the mock.
- The AI node reads only the **first** LoRA it is given, so the picker is single-choice.
- There is no logout endpoint and no refresh token. Signing out is local; a long session ends
  with a re-entry, not a silent renewal.
- `/healthz` and `/api/status` both return **500**: `main.py` reads `settings.…` at lines 66 and
  77–78 without importing it. The rail says "status unavailable" rather than guessing, and
  `systemService` is written to the documented shape so it starts working the moment that
  one-line import is added.
- `requirements.txt` is missing **`passlib`**, which `app/core/security.py` imports — a clean
  install of the backend fails to start until it is added. (The import is unused; bcrypt is
  called directly.)

**Things the API cannot do yet, and are therefore not drawn**

- No cancel. The AI node implements `DELETE /ai/task/{id}`, the backend exposes nothing that
  reaches it, so no cancel button exists.
- No progress. Neither node reports a percentage, a queue position or a step count, so the UI
  shows elapsed time and an indeterminate indicator — never an invented bar.
- No history filters. `GET /generations` takes only `page` and `page_size`.
- No model list. The AI node has `GET /ai/models`, but the browser must not call Node 3.
  `src/config/models.ts` mirrors the registry until the backend proxies it — replace that one
  file when it does.
- The seed actually used is never returned, so "reuse this seed" is only possible for a seed
  the person typed themselves.
- Nothing times a job out server-side: a lost callback leaves a row at `processing` forever.
  The client stops polling after five minutes and says so plainly.

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
