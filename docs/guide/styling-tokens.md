# Styling Tokens

> This page documents the CSS custom property (a.k.a. "design token") system
> used by `@ai-assistant/vue`. It is targeted at maintainers and at hosts who
> want to override the visual layer **without** monkey-patching the bundled
> selectors.

## The cascade in one picture

CSS files under `ai-assistant-ui/src/components/styles/` are loaded in
**alphanumeric order** (`00-*` → `99-*`). The Vite library build concatenates
them into a single `style.css`, so later files win on tie-broken specificity.

```text
00-fonts.css                       ─ font primitives
00-enterprise-tokens.css           ─ TOKENS (this page is about these)
01-shell.css                       ─ shell / layout                ┐
02-header-messages.css             ─ header + message bubbles      │
03-input-popups.css                ─ input area + popups           │
04-features.css                    ─ feature slots                 │  domain
05-overlays-resize.css             ─ panel overlays + resize       │  layers
06-page-feedback.css               ─ toast / banners               │  (legacy,
07-voice-thinking.css              ─ voice + reasoning UI          │   per-area)
08-late-additions.css              ─ B8 mermaid + line numbers     │
09-modern-overhaul.css             ─ UX modernization wave 3-4 (✱) │
10-polish-wave-6.css               ─ polish wave 6                 │
11-refinement-and-performance.css  ─ D1 ResizeObserver, polish     │
12-extreme-performance.css         ─ G2 polish, perf               ┘
99-enterprise-overhaul.css         ─ Doubao-clone visual layer (✱)
```

✱ The two `*-overhaul.css` layers are deliberate cascade overlays. `09` adds
the "modern" UX wave; `99` re-skins the assistant into a Doubao-clone
aesthetic. **Removing either file is a single-PR rollback** of the entire
visual change.

## Token families

Token names live on a small set of root selectors so they cascade into the
right subtrees:

```css
.ai-assistant-wrapper,
.ai-personalize-overlay,
.ai-form-fill-overlay,
.ai-form-fill-toast {
  /* tokens go here */
}
```

| Family | Prefix | Examples | Defined in | Use for |
|---|---|---|---|---|
| Typography | `--ai-font-*`, `--ai-text-*`, `--ai-leading-*`, `--ai-tracking-*` | `--ai-font-display`, `--ai-text-base` (13px), `--ai-leading-base` (1.56) | `00-enterprise-tokens.css` | All text |
| Spacing | `--ai-space-N` | `--ai-space-3` (12px), `--ai-space-6` (24px) | `00-enterprise-tokens.css` | All gaps, paddings, margins. Avoid raw `px`. |
| Radius | `--ai-radius-*` | `--ai-radius-base` (12px), `--ai-radius-pill` (999px) | `00-enterprise-tokens.css` | All `border-radius` |
| Motion | `--ai-ease-*`, `--ai-dur-*` | `--ai-ease-out`, `--ai-dur-base` (220ms) | `00-enterprise-tokens.css` | All `transition` / `animation` |
| Color | `--ai-color-*` (new) | `--ai-color-primary`, `--ai-color-text-secondary`, `--ai-color-surface` | `00-enterprise-tokens.css` | **All new code.** |
| Gradient | `--ai-grad-*` | `--ai-grad-brand`, `--ai-grad-brand-soft` | `00-enterprise-tokens.css` | All gradient `background:` |
| Bubbles | `--ai-color-user-bubble*`, `--ai-color-assistant-bubble*` | — | `00-enterprise-tokens.css` | Chat bubbles only |
| Shadow | `--ai-shadow-*` | `--ai-shadow-sm`, `--ai-shadow-md`, `--ai-shadow-glow` | `00-enterprise-tokens.css` | All `box-shadow` |
| Z-index | `--ai-z-*` | `--ai-z-panel`, `--ai-z-toast` | `00-enterprise-tokens.css` | Anything that floats |

### Legacy color tokens (do NOT add new ones)

These predate `00-enterprise-tokens.css` and are still set inside
`09-modern-overhaul.css` for cascade reasons. They are **not** removed because
`09` and many `01..12` selectors still consume them. **Do not introduce new
hex values into these names** — if you need a colour, pull it from
`--ai-color-*` instead.

| Legacy token | Approximate new replacement |
|---|---|
| `--primary` | `--ai-color-primary` |
| `--ai-gradient-1 / -2 / -3` | use `--ai-grad-brand` or any `--ai-color-accent-*` |
| `--ai-glass-bg / -border / -bg-soft` | `--ai-color-surface` + `--ai-color-border` |
| `--ai-shadow-soft / -glow` | `--ai-shadow-md` or `--ai-shadow-lg` |
| `--ai-text` | `--ai-color-text-primary` |
| `--ai-text-muted` | `--ai-color-text-secondary` |
| `--ai-border` | `--ai-color-border` |
| `--ai-bg / -bg-soft` | `--ai-color-bg-base` / `--ai-color-bg-canvas` |
| `--ai-hover` | `--ai-color-bg-hover` |

The migration is intentionally **gradual and reactive**: when you touch a
selector that consumes a legacy token, opportunistically swap it for the new
`--ai-color-*` equivalent. No big-bang refactor PRs.

## Dark theme

Dark theme is a single overlay block in `00-enterprise-tokens.css`:

```css
.ai-assistant-wrapper.ai-dark,
.ai-dark.ai-personalize-overlay,
.ai-dark.ai-form-fill-overlay,
.ai-dark.ai-form-fill-toast {
  /* only the tokens that need to invert go here */
}
```

When you add a new component, *do not* hand-write dark-mode rules. Use
`--ai-color-*` tokens; the overlay will flip them for you. If a new colour
needs a dark variant, add it to **both** the light scope (default) and the
`.ai-dark` overlay in `00-enterprise-tokens.css`. Never define a dark colour
in a domain layer (`01..12`).

`prefers-reduced-motion` is also handled at the token layer: the three
`--ai-dur-*` durations are set to `0ms` in that media query, so any
`transition` consumer downgrades automatically.

## Rules for new CSS

1. **No hex values in `01..12` layers.** Pull from `--ai-color-*` and friends.
   If the token does not exist, add it to `00-enterprise-tokens.css` first
   in a separate commit.
2. **No raw `px` for spacing.** Use `--ai-space-N`.
3. **No raw `px` for radii.** Use `--ai-radius-*`.
4. **No raw transition timing.** Use `--ai-ease-*` and `--ai-dur-*`.
5. **No new `!important`.** If you need to override a legacy `01..12`
   declaration, add specificity (e.g. add `.ai-assistant-wrapper` parent)
   or move into `09` / `99`.
6. **No new `NN-*.css` slice without discussion.** The cascade is already 15
   layers; adding more makes BEM debugging exponentially harder. Prefer
   adding to `99-enterprise-overhaul.css` (Doubao overlay) or to a domain
   layer (`02-header-messages.css`, etc.) when the change fits.
7. **Document dead-code candidates.** When you delete a Vue template element
   that consumed a selector, add a one-line entry to
   `styles/DEAD_CODE_CANDIDATES.md` with the selector and a date. We sweep
   that file quarterly.

## Host overrides

Hosts who want to customise the look without forking should override tokens
on the host root, **not** on the bundled selectors:

```css
/* host's own stylesheet, loaded AFTER @ai-assistant/vue */
.ai-assistant-wrapper,
.ai-personalize-overlay,
.ai-form-fill-overlay {
  --ai-color-primary: #1ec6a0;        /* your brand */
  --ai-grad-brand: linear-gradient(135deg, #1ec6a0, #047857);
  --ai-radius-base: 8px;              /* squarer corners */
  --ai-dur-base: 180ms;               /* faster transitions */
}

.ai-assistant-wrapper.ai-dark {
  --ai-color-primary: #2dd4bf;        /* lighter for dark */
}
```

This way your overrides survive future bumps of `@ai-assistant/vue` even if
the bundled stylesheet adds or removes a selector.

## Diagnostics

If a colour doesn't look right and you suspect a token override:

```js
// In DevTools console, on the assistant wrapper element
const w = document.querySelector('.ai-assistant-wrapper');
getComputedStyle(w).getPropertyValue('--ai-color-primary');
getComputedStyle(w).getPropertyValue('--primary');           // legacy
getComputedStyle(w).getPropertyValue('--ai-grad-brand');
```

If a token resolves to an unexpected value, search the codebase for that
exact token name to find every layer that touches it. The cascade order in
the picture at the top of this page tells you who wins.
