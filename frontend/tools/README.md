# Browser checks

Headless Chrome driven over the DevTools protocol, because the parts of this
interface that broke were never visible to a type checker.

`cdp.mjs` launches Chrome and exposes `viewport`, `go`, `shot`, `evaluate` and
`drain` (console and network errors since the last call). The two sweeps use it.

| Script | Asks |
|---|---|
| `overflow-sweep.mjs` | Does any page scroll sideways, log an error, or return a 4xx — across roles, languages and widths |
| `visibility-sweep.mjs` | Is every button, link and field **actually visible and inside the viewport** |

The second one exists because of a specific failure. The user drawer borrowed
the progress-bar keyframe, which ends at `left: 100%`, so it came to rest just
off the right edge of the screen. Every check written at the time asked
`!!document.querySelector('.adm-drawer')` — and the element was there the whole
time, correct in every way except that nobody could see it. Presence in the DOM
is not visibility, and an existence check cannot tell the difference.

```bash
# with the app and backend running
SCRATCH=./tools OWNER=<token> REV=<token> node tools/overflow-sweep.mjs
SCRATCH=./tools OWNER=<token> node tools/visibility-sweep.mjs

# a token:
curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'username=alice' --data-urlencode 'password=SecurePassword123!'
```

Chrome is expected at the macOS default path; change `CHROME` in `cdp.mjs`
otherwise.
