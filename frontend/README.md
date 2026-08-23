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

- **Text to image** — prompt, model, size preset, seed
- **Image to image** — drag-and-drop upload with real progress, replace/remove, change amount
- **Inpaint** — brush/eraser mask painting with undo, redo, clear, mask-only preview, and
  keyboard shortcuts (`B` `E` `[` `]` `⌘Z`)

**History** — paginated runs with status, click through to full parameters, save the image,
or reuse the settings.

**Account** — profile, theme, sign out.

`⌘↵` generates from anywhere.

---

## How it is put together

```text
src/
  app/          routes, guards, error boundary, query client
  config/       base URL, parameter limits, model list, polling policy
  contracts/    request/response types mirrored from the backend's Pydantic schemas
  services/     apiClient + auth · user · upload · generation · system
  shared/       tokens, primitives, hooks, formatting
  features/
    auth/       sign-in, register, session store, expired-session dialog
    generate/   workspace shell, mode fields, upload, canvas/, run/
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
