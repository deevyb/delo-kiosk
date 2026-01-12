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

**Delo Coffee** runs pop-up coffee events 1-2 times per month, serving 100-150 customers per event. The app replaces paper order cards that get lost or shuffled.

**The Solution:** iPad-based ordering where customers tap their order, it appears instantly on the kitchen display, and nothing gets lost.

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

1. Get through next pop-up with zero lost orders
2. App never crashes or freezes during the rush
3. Customers find it intuitive (no explanation needed)
4. Looks and feels like a natural extension of Delo's brand
5. Every interaction feels smooth and polished

---

## Specialized Plugins

### `/frontend-design`
For building new screens where visual creativity matters, or exploring multiple design directions.

### `/feature-dev`
For major features that touch many files or require understanding the whole system.

---

## Reference Documents

| File | Purpose |
|------|---------|
| `TECHNICAL.md` | Architecture, schema, API, design decisions |
| `.claude/rules/status.md` | Current status and next tasks (auto-loaded) |
| `Delo Coffee Ordering App – MVP Spec.md` | Functional requirements |
| `Delo Coffee Brand Identity.md` | Brand story and voice |
