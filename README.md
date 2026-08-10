# trustbit_theme — a premium login screen for Frappe / ERPNext v16

A drop-in Frappe app that replaces the stock ERPNext login page with a split-screen branded design and a "prism refraction" motion system.

It is a **separate app on purpose**: `bench update` overwrites `apps/frappe/**`. The v16 update that prompted this rewrote `www/login.html` (+235 lines) and `login.bundle.scss` (+524 lines) — anything customised in core would have been destroyed. This app touches **no** Frappe or ERPNext source file.

- Tested on **Frappe v16 / ERPNext v16** (16.29 / 16.30)
- No build step, no npm dependencies, no external requests
- Auto-brands itself from your site's own logo and app name
- Uninstall restores the stock page instantly

---

## Install

```bash
cd ~/frappe-bench
bench get-app trustbit_theme https://github.com/zxrrcpandey/login-ERP.git
bench --site <your-site> install-app trustbit_theme
bench --site <your-site> clear-cache
sudo supervisorctl restart all      # or `bench restart`
```

Then **hard-refresh** the login page.

> Pass the app name explicitly (`bench get-app trustbit_theme <url>`) because the repository name and the app name differ.

### If `bench get-app` is not an option

```bash
cd ~/frappe-bench/apps
git clone https://github.com/zxrrcpandey/login-ERP.git trustbit_theme
cd ~/frappe-bench
./env/bin/python -m pip install -e apps/trustbit_theme

# apps.txt has NO trailing newline — rewrite it, never append with >>
printf 'frappe\nerpnext\ntrustbit_theme\n' > sites/apps.txt   # list YOUR apps

ln -sfn ~/frappe-bench/apps/trustbit_theme/trustbit_theme/public \
        ~/frappe-bench/sites/assets/trustbit_theme

bench --site <your-site> install-app trustbit_theme
bench --site <your-site> clear-cache
sudo supervisorctl restart all
```

**Do not run `bench build --app trustbit_theme`.** These are plain `.css`/`.js` files (not `*.bundle.*`), so they need no compilation — only the assets symlink above. On small VPSes the bundler gets OOM-killed anyway (`exit status 143` = SIGTERM).

## Uninstall

```bash
bench --site <your-site> uninstall-app trustbit_theme
```
The stock Frappe login page returns immediately. Nothing in core was modified.

---

## Configure

Everything you need to change lives in one `CONFIG` block at the top of
`trustbit_theme/public/js/trustbit_login.js`:

```js
var CONFIG = {
  logo: null,                    // null = reuse Website Settings → App Logo
  badge: "ERP",                  // small chip beside the logo ("" to hide)
  eyebrow: "Internal Workspace &middot; {app}",   // {app} = your app name
  headline: "Where your team gets",
  headlineAccent: "work done.",  // gets the gradient — keep 2+ words
  intro: "Sign in to pick up your tasks, …",
  features: [ "…", "…", "…" ],
  footer: null,                  // null = "© <year> <app name>"
};
```

**Out of the box it needs no edits.** The logo and app name are read from your site's own `Website Settings`, using the logo already rendered on the login card — so a fresh install is branded correctly. If no logo is set, the app name renders as text rather than a broken image.

### Colours
CSS custom properties at the top of `trustbit_theme/public/css/trustbit_login.css`:
`--tb-b1` (indigo), `--tb-b2` (violet), `--tb-b3` (teal), plus `--tb-*` surface and text tokens.

The theme ships **pinned to light** so every user sees the same screen. To follow the visitor's OS setting instead, wrap the light tokens in `@media (prefers-color-scheme: light)` and restore a dark set on the base rule.

### ⚠️ After ANY edit, bump the cache-buster
nginx serves `/assets` with `Cache-Control: max-age=31536000` (one year) and these filenames are not content-hashed, so **returning browsers will never see your change** unless the query string changes:

```python
# trustbit_theme/hooks.py
web_include_css = "/assets/trustbit_theme/css/trustbit_login.css?v=7"
web_include_js  = "/assets/trustbit_theme/js/trustbit_login.js?v=7"
```

---

## How it works

```python
web_include_css = "/assets/trustbit_theme/css/trustbit_login.css?v=6"
web_include_js  = "/assets/trustbit_theme/js/trustbit_login.js?v=6"
```

`web_include_*` loads on every **website** page (`app_include_*` is desk-only and never reaches `/login`), so both files no-op unless the login page is showing. Frappe stamps the page name on the body:

```html
<body frappe-session-status="logged-out" data-path="login">
```

- CSS is scoped entirely to `body[data-path="login"]`
- JS returns immediately unless `data-path === "login"`

### It *moves* Frappe's nodes, never rebuilds them

`enhance()` wraps the existing `.page_content` in a split-screen shell and adds a brand panel beside it, using `appendChild` to **move** the node. Every handler Frappe's `login.js` bound (`.form-login`, `.btn-login`, `#login_email`, `#login_password`, `.field-error`, …) stays attached. Rebuilding that markup would break authentication.

All of it is wrapped in `try/catch`: if anything throws, the stock login page is left exactly as-is and sign-in still works. **Preserve that property in any edit.**

The app also serves `/favicon.ico` via a `website_redirects` hook — Frappe 404s that path by default, so browsers fall back to a stale cached icon.

---

## THE SAFETY RULE (read before touching the CSS)

> The hidden state (`opacity:0`, `visibility:hidden`, `scale(0)`, a closed `clip-path`) may appear **only inside an `@keyframes` `from`/`0%` step — never in a base rule.** Every entrance animation must use `animation-fill-mode: both`.

This is a login screen. The natural way to write an entrance is a trap:

```css
/* FORBIDDEN — if the animation never runs, nobody can sign in */
.thing { opacity: 0; animation: fade 1s forwards; }

/* CORRECT — falls back to fully visible */
@keyframes fade { from { opacity: 0 } to { opacity: 1 } }
.thing { animation: fade 1s var(--tb-ease) both; }
```

That is what makes the global opt-out safe:

```css
@media (prefers-reduced-motion: reduce) {
  body[data-path="login"] *, ::before, ::after { animation: none !important; }
}
```

**Audit command — must report 0:**

```bash
python3 - trustbit_theme/public/css/trustbit_login.css <<'PY'
import re,sys
css=open(sys.argv[1]).read()
out=[];i=0
while i<len(css):
    m=re.compile(r'@(-webkit-)?keyframes[^{]*\{').search(css,i)
    if not m: out.append(css[i:]); break
    out.append(css[i:m.start()]); d=0;j=m.end()-1
    while j<len(css):
        if css[j]=='{': d+=1
        elif css[j]=='}':
            d-=1
            if d==0: break
        j+=1
    i=j+1
print("base rules with hidden state:",
      len(re.findall(r'\{[^{}]*(?:opacity\s*:\s*0(?!\.)|visibility\s*:\s*hidden)[^{}]*\}', ''.join(out))))
PY
```
Decorative `::before` / `::after` overlays meant to be invisible at rest are the one acceptable exception — they hide nothing.

---

## Design notes worth keeping

**The headline MUST stay split into line spans.**

```html
<h1><span class="tb-h1line1">…</span>
    <span class="tb-h1line2"><span class="tb-accent">…</span>
    <span class="tb-accent">…</span></span></h1>
```

Animating `text-shadow` on an `<h1>` that contains `background-clip:text` spans **intermittently drops the entire headline's paint in Chrome** — reproduced 5/8 renders; 0/10 once moved onto the line spans. The CSS animates `.tb-h1line1` / `.tb-h1line2`, never the `h1`. Do not "simplify" this back into one element. This is also why `headlineAccent` should be 2+ words — the effect targets the second `.tb-accent` span.

**Pseudo-element budget is fully allocated.** Need another layer? Add an element; don't reclaim one of these.

| Element | Used by |
|---|---|
| `.tb-brand::before` | prism beam |
| `.tb-brand::after` | ambient rake |
| `.tb-formside::before` | bloom behind the card |
| `.login-content.page-card::before` | spectral edge filament |
| `.login-content.page-card::after` | pointer-tracked glint |

The depth grid lives in a real `<i class="tb-grid">` element because `.tb-brand::after` was needed by the rake.

**Performance, honestly.** Chromatic aberration is a *paint* effect, not GPU-composited. The split is entrance-only (<0.7s per element, no layout work). Two deliberate idle repaints remain: the accent spectrum drift (14s) and the card edge ring (13s). The ring is the most expensive idle item — its mask repaints a card-sized box for 1px of visible output. Both are the first things to drop if you profile badly.

---

## Verify an install

```bash
SITE=https://your-site.example
curl -s $SITE/login | grep -oE '/assets/trustbit_theme/[a-z]+/[a-z_]+\.(css|js)\?v=[0-9]+'
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/assets/trustbit_theme/css/trustbit_login.css?v=6"

# most important check: authentication still works
curl -s -X POST $SITE/api/method/login \
  -H 'Content-Type: application/json' \
  -d '{"usr":"Administrator","pwd":"<password>"}'
#   expect {"message":"Logged In"}
```

## Compatibility

| | |
|---|---|
| Frappe | v16 (developed against 16.29) |
| ERPNext | v16 (optional — this themes Frappe's login page) |
| Build tooling | none |
| External requests | none (no CDN, no fonts, no trackers) |

The v16 login page was **redesigned** in the 16.17 → 16.29 range (`feat: redesigned login/signup pages`). On older v16 builds the class hooks this app targets (`.login-content.page-card`, `.page-card-head`, `.email-field`, `.password-field`, `.toggle-password`) differ, and the theme will not apply cleanly.

## Licence

MIT — see [LICENSE](LICENSE).
