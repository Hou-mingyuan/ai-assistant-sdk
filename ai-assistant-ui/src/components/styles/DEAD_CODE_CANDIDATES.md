# Dead-code candidates — CSS layers

> This file tracks CSS selectors that we **suspect** are no longer reachable
> from any Vue template. We deliberately do **not** delete them on suspicion;
> the file is a quarterly sweep target instead.
>
> Verification rule: a selector can be removed when (a) `rg` finds zero
> matches in `ai-assistant-ui/src/components/**/*.vue` for its key class name,
> AND (b) `rg` finds zero matches in `ai-assistant-vue-playground/src/`, AND
> (c) it is not referenced by any composable's `classList.add` / `data-*`
> hook. We do NOT count host-side projects, so a host that templates against
> the bundled class string will continue to work until a removal **major**
> bump.
>
> Format:
>
> ```text
> ## <layer file>
>
> - `selector-or-prefix` — added <YYYY-MM-DD>; reason it became dead;
>   removal target (YYYY-Q?).
> ```

## 09-modern-overhaul.css

- `.ai-empty-skill`, `.ai-empty-skill-icon`, `.ai-empty-skill-text`,
  `.ai-empty-skills` — added 2026-05-13; replaced 2026-05-16 when the
  empty-state in `AiAssistant.vue` was reworked from a horizontal chip
  strip to the prompt-templates row. CSS kept for rollback during K56 wave.
  Removal target: 2026-Q3.

- `.ai-empty-starter`, `.ai-empty-starter-icon`, `.ai-empty-starter-text`,
  `.ai-empty-starters` — added 2026-05-13; replaced 2026-05-16 when the
  4-card starter grid was removed from the empty-state. Removal target:
  2026-Q3.

## 99-enterprise-overhaul.css

- `.ai-empty-skill*`, `.ai-empty-starter*` mirror selectors — added
  2026-05-16 during the K56 Doubao overhaul; same removal target as the
  09-layer counterparts. The mirror exists because `99` was written to be
  the "definitive" empty-state look; once we delete the 09 rules these
  ones lose their original cascade context.

## (none yet — add as you delete templates)

When you delete a Vue template element that consumed a class only used by
the assistant SDK (not by host CSS), come back and add a one-line entry to
the matching layer above. Include:

* the **exact** selector or selector prefix
* the date you stopped templating against it
* a one-sentence reason
* a removal target quarter (≥ 1 quarter out)

## Sweep procedure

Each quarter (loose schedule):

```bash
# For every candidate above, prove it's actually dead:
rg -n "ai-empty-skill" ai-assistant-ui/src ai-assistant-vue-playground/src
rg -n "ai-empty-starter" ai-assistant-ui/src ai-assistant-vue-playground/src

# Both should print nothing. Then delete the corresponding CSS blocks in
# 09-modern-overhaul.css and 99-enterprise-overhaul.css, re-run the
# bundle-size check, and commit as:
#
#   style(ui): sweep dead CSS (.ai-empty-skill* / .ai-empty-starter*)
```

After the sweep, expect `style.css` gzip to drop by a few KB. If the drop
is larger than expected, double-check no host integration relied on the
removed selectors.

## Anti-rules

* Do NOT delete a selector "because it isn't used in tests". Tests aren't a
  complete consumer set.
* Do NOT delete from `00-enterprise-tokens.css` regardless of how
  unreferenced a token looks; hosts override tokens by name and removing
  one becomes a breaking change.
* Do NOT delete `01..08-*.css` selectors without checking the playground;
  the playground sometimes templates against assistant classes for its own
  decoration.
