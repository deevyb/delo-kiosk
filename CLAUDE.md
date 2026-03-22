# Delo Coffee Kiosk - Project Guide

## Who I'm Building For

**Owner:** Non-technical founder who knows exactly what they want — and wants to understand what's being built.

**Communication Rules:**

- Explain technical concepts in plain, accessible language
- Focus on meaningful learning moments, not every tiny choice
- When a decision has real trade-offs, share options, implications, and your recommendation
- Make real-world implications clear: "This means the app will load faster" not "This reduces bundle size"
- **Always pause for manual testing before committing** — ask owner to test, wait for confirmation

---

## The Business

**Delo Coffee** — pop-up coffee events, 100-150 customers/event. iPad kiosk replaces paper order cards.

---

## The Brand

Inspired by the _delo_ — a traditional Indian courtyard where strangers become friends.

- **Warm & cozy** — like being welcomed into someone's home
- **Playful** — not stuffy or pretentious
- **Heritage-rooted** — honors tradition without being dated

**Colors:** Maroon `#921C12`, Cream `#F9F6EE`, Navy `#000024`, Terracotta `#C85A2E`

**Fonts:** Yatra One (title), Bricolage (drinks/buttons), Cooper (labels), Manrope (options), Roboto Mono (descriptions)

---

## Critical Requirements

**Must-Haves:**

- Stability above all — biggest fear is crashes/freezes during rush
- Beautiful, silky animations (Framer Motion throughout)
- Real-time sync — orders appear instantly on kitchen display
- Fully editable menu — nothing hardcoded
- iPad landscape only

**Out of Scope:** Payments, prices, order numbers, multi-item orders, customer accounts

---

## Success Criteria

Zero lost orders. No crashes during rush. Intuitive with no explanation needed. On-brand and silky smooth.

---

## Skill Usage (MANDATORY)

**Check this table before starting any task. If a trigger matches, invoke the skill — do not wait to be asked.**

| Trigger                                           | Skill                          | When                                 |
| ------------------------------------------------- | ------------------------------ | ------------------------------------ |
| New UI, screens, or visual direction              | `/frontend-design`             | Before writing UI code               |
| UI polish (animations, hover, shadows)            | `/make-interfaces-feel-better` | After UI code, before review         |
| Editing TSX/JSX components                        | `/react-best-practices`        | After all component edits            |
| Feature touching 3+ files, new routes, DB changes | `/feature-dev`                 | Before starting implementation       |
| Any code changes                                  | `/simplify`                    | After implementation, before testing |
| Planning multi-step work                          | `/brainstorm`                  | Before writing any plan              |
| Editing CLAUDE.md                                 | `/revise-claude-md`            | Before making changes                |

**Do NOT skip skills.** Don't rationalize ("it's simple enough"). If a trigger matches, invoke it. If unsure, invoke it — checking is cheaper than missing.

---

## Reference Documents

| File                                     | Purpose                                     |
| ---------------------------------------- | ------------------------------------------- |
| `TECHNICAL.md`                           | Architecture, schema, API, design decisions |
| `.claude/rules/status.md`                | Current status and next tasks (auto-loaded) |
| `Delo Coffee Ordering App – MVP Spec.md` | Functional requirements                     |
| `Delo Coffee Brand Identity.md`          | Brand story and voice                       |

---

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run format` — Prettier
