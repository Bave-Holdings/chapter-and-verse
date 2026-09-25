# Chapter & Verse: answer rendering spec (for Talha)

The answer structure is done. This spec covers how each part should **look and behave** on screen.

- `cv-answer.css`: all tokens and component styles. Drop it in; every class starts with `cv-`.
- `reference.html`: open it in a browser. It shows every component rendered with real content. Copy the markup pattern for each block.

---

## 1. The one rule
**Each color means one thing, everywhere.**

| Color | Meaning | Used for |
|---|---|---|
| Green | Clear / yes / source | Clear verdicts and badges, source citations, primary buttons |
| Blue | Fixable / the plan | "Possibly doable" verdicts, Fixable badges, the timeline |
| Red | Blocker / stop | "No" verdicts, Blocker badges, STOP IF callouts, the Don't list |
| Yellow tint | Watch out | The common-mistake callout |
| Amber | Lender overlay | Overlay citation chips **only** |
| Slate | Not found | "Not in your documents" verdict |

Never use amber for warnings or errors. Never use color alone: every badge has an icon and a word.

---

## 2. Map structure → component

| Answer field | Component | Class |
|---|---|---|
| scope | Scope line | `.cv-scope` (`--notfound` for misses) |
| verdict + verdict type | Verdict banner | `.cv-verdict--clear / --fixable / --blocker / --notfound` |
| status counts | Counts inside the banner | `.cv-verdict__counts` |
| (long answers) | Jump bar | `.cv-jump` |
| borrower script | Dark script card + Copy | `.cv-script` |
| key "don't" line | White callout | `.cv-callout--key` |
| status items | Badge rows | `.cv-status` + `.cv-badge--*` |
| steps | Numbered step cards | `.cv-steps` > `.cv-step` (`--final` on the last) |
| step bullets | Bullets | `.cv-bullets` |
| stop rule | Red callout inside its step | `.cv-callout--stop` |
| watch out | Yellow callout | `.cv-callout--watch` |
| next step (short answers) | Dark-tag callout | `.cv-callout--next` |
| conditions (short answers) | Numbered circles | `.cv-conditions` |
| plan B | Timeline | `.cv-timeline` |
| easiest fix | Blue callout | `.cv-callout--path` |
| don'ts | Red-x list | `.cv-donts` |
| documents | Checklist + actions | `.cv-checklist` + `.cv-actions` |
| citations | Chips | `.cv-cite--source / --overlay` |
| verify line + feedback | Footer | `.cv-footer` |
| anything that arrives as plain markdown | Prose fallback | `.cv-prose` |

---

## 3. Which blocks show, by answer size

| Block | Short answer | Complex scenario |
|---|---|---|
| Scope line | ✅ | ✅ |
| Verdict banner | Compact (`--compact`) | Full, with counts |
| Jump bar | ❌ | ✅ when 4+ sections |
| Script | Only if a borrower is involved | ✅ |
| Status list | ❌ | ✅ |
| Steps | Conditions or one Next step | ✅ with progress bar |
| Timeline | Blue "If it's a no" callout | ✅ |
| Don'ts | One Watch out | ✅ list |
| Checklist | If documents needed | ✅ |
| Citations | ✅ always | ✅ in each step + footer |

Short answers render inside one white card (`.cv-answer--short`). Complex answers render as open sections with no outer card.

**Rule:** if a field is empty, don't render its block. No empty headings.

---

## 4. Ordering rules (enforce in the renderer, not the model)
- Status rows: sort **Clear → Fixable → Blocker**.
- Verdict counts: computed from the status list, not written by the model.
- Steps: keep model order; the last step always gets `--final` (green number).
- Citations: source chips before overlay chips.

---

## 5. Behavior
- **Step checkboxes:** toggle `.is-done` on the step (strikes the title, shows a check), update the progress bar and "X of 5 done". **Save the state with the chat** so it's still there tomorrow.
- **Checklist items:** checked items grey out. Save state with the chat.
- **Copy script:** copies the quote text only, without quote marks. Show a "Copied" state for 2 seconds.
- **Email list to borrower:** opens a pre-filled email with the checklist.
- **Citation chip click:** opens the source panel at that page and sets `aria-pressed="true"` on the chip.
- **Jump bar:** anchor links. Sections have `scroll-margin-top` so they clear the sticky header.
- **STOP IF links** jump to the plan section.

---

## 6. Streaming
Render blocks in this order as data arrives: scope → verdict → script → status → steps → plan → don'ts → checklist → citations. Show `.cv-skeleton` lines for a block until it arrives. Don't let the verdict banner jump or resize after it appears.

---

## 7. Typography and spacing (already in the CSS)
- Font: Inter (Helvetica Neue stand-in). Verdict 28px/800, step titles 17px/700, body 15px, labels 12px caps.
- Max answer width 860px, so lines stay readable.
- 28px between sections, 12px inside a section.
- Bold only: step titles, the verdict, key phrases inside bullets. Never whole paragraphs.

---

## 8. Must-haves
- Responsive: under 720px the status list and timeline stack vertically (in the CSS).
- Keyboard: every control reachable, visible focus ring (in the CSS).
- Reduced motion respected (in the CSS).
- Print/export: hides buttons and checkboxes, keeps colors (in the CSS). Use this for "Export with citations".
- Contrast: never put bright green `#1FD68A` text on white. Use `--cv-green-text`.

---

## 9. Test checklist
- [ ] Nightmare Conventional Call renders like `reference.html`
- [ ] A short "yes" answer shows no empty sections
- [ ] A "not found" answer shows slate, never amber
- [ ] Status rows are sorted and counts match
- [ ] Checked steps and documents survive a page reload
- [ ] Looks right at 375px wide
- [ ] Printed export is readable in black and white
