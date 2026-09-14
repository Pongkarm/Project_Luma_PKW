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

The phone widths are 390×844 and **402×740** — an iPhone 17 / 17 Pro with
Safari's toolbars showing. The second exists because a full-height viewport is
one no Safari tab ever has, and the controls sheet only slid under the tab bar
at the shorter height. For the same reason the overflow sweep also asks whether
the document scrolls vertically or anything in the workspace reaches under the
tab bar; sideways overflow never showed either.

A finished image pushed the whole controls sheet off every phone width, and no
page load shows one. `RUN=1` makes the overflow sweep press Generate once per
phone size and check again once the result is on screen. It creates real runs,
so it is opt-in.

```bash
# with the app and backend running
SCRATCH=./tools OWNER=<token> REV=<token> node tools/overflow-sweep.mjs
SCRATCH=./tools OWNER=<token> REV=<token> RUN=1 node tools/overflow-sweep.mjs   # also press Generate
SCRATCH=./tools OWNER=<token> node tools/visibility-sweep.mjs

# a token:
curl -s -X POST http://localhost:8000/auth/login \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'username=alice' --data-urlencode 'password=SecurePassword123!'
```

Chrome is expected at the macOS default path; change `CHROME` in `cdp.mjs`
otherwise.
