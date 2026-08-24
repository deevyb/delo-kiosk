# Tap to Pay with Venmo — Setup Guide

Everything you need to get paid at an event: what to buy, how to program the
sticker, where to stick it, and what to test before you open.

Set aside about 20 minutes the first time. After that it's a 2-minute check
before each event.

---

## How it works, in one paragraph

A team member takes the order on their own phone at `/order?pay=1`. When they
hit Send, the screen turns into a customer-facing payment screen: name, drink,
price, a QR code, and a big arrow at the bottom saying "Tap your phone under
here." They flip the phone around to face the customer. The customer holds
their phone underneath, a Venmo banner pops up, and Venmo opens with your
handle, the price, and a note already filled in. They hit Pay. Done.

The magic is a **sticker**, not the app. A sticker on the back of the
order-taker's phone holds your Venmo link, and the customer's phone reads it.
This isn't a workaround — a website on an iPhone simply cannot broadcast a tap
signal, so a sticker is the only way to do this without buying a card reader.
The upside: the sticker costs about 40 cents and never needs charging.

---

## 1. What to buy

Search any online store for **"NTAG213 NFC sticker."** NTAG213 is just the chip
type — the common, cheap one that every phone can read.

| What           | Get this                              | Why                                                                  |
| -------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Chip type      | NTAG213                               | Universally readable; plenty of room for a link                      |
| Shape and size | Round, **25 mm or larger**            | Smaller ones need a fussier, more exact tap                          |
| Type           | **Standard** stickers, not "on-metal" | On-metal versions cost more and you almost certainly don't need them |
| How many       | One per team phone, plus a few spares | They're sold in packs of 10–50 for a few dollars                     |

**The one exception:** if a phone case has metal in it (a magnetic wallet, a
metal plate, a PopSocket base), get **"on-metal" or "anti-metal" NTAG213
stickers** for that phone. Metal behind a normal sticker kills the signal.

Every team phone gets an **identical** sticker with the exact same link. There's
nothing to route or keep straight — three people can take orders at once and
every payment lands in the same place.

---

## 2. Write your link onto the sticker

You'll need the free app **NFC Tools** (iPhone or Android — either works, and
it doesn't matter which one you use to write; the sticker works with everything
afterward).

**Your link is:**

```
https://venmo.com/u/YOUR-HANDLE?txn=pay&amount=6.00&note=Delo%20Coffee
```

Replace two things:

- **`YOUR-HANDLE`** — your Venmo username with **no `@`** in front. If you're
  `@delo-coffee`, write `delo-coffee`.
- **`6.00`** — your flat price for the event. Always two digits after the dot,
  and **no dollar sign**. Six dollars is `6.00`, not `$6` or `6`.

Leave the rest exactly as written. `%20` is just how a space is spelled inside a
link, so `Delo%20Coffee` shows up in Venmo as the note "Delo Coffee."

**Steps in NFC Tools:**

1. Open the app and go to the **Write** tab.
2. Tap **Add a record** → choose **URL / URI**.
3. Paste your link and confirm.
4. Tap **Write**, then hold the sticker against the top back of your phone until
   it says success. (About two seconds.)
5. Repeat for each sticker. Same link every time.

**Optional, and only once you're sure of your handle and price:** NFC Tools has
an **Other → Make read-only** function that locks the sticker permanently. It
protects against accidental overwrites, but it is genuinely permanent — a locked
sticker can never be changed, only replaced. Skip this until you've run a real
event.

> **Why an `https://venmo.com/...` link and not something shorter?** Because
> iPhones ignore app-only links (`venmo://`) both when reading stickers in the
> background and when scanning QR codes with the camera. The `venmo.com` version
> still opens the Venmo app directly — no browser detour — and it's the same
> link the on-screen QR code uses.

---

## 3. Where to stick it

**Lower back of the phone** (or of the case — either is fine), centered
side-to-side, roughly a third of the way up from the bottom.

Not the top. An iPhone's own tap antenna lives in the top-rear of the phone, and
putting your sticker there makes the two fight each other.

That placement is also why the customer's phone goes **underneath**. Phones read
stickers with their **top edge**, so when a customer slides their phone under
yours, the top edge is the first thing that arrives — and it lands right on the
sticker. Tapping on top of the phone, the way people expect, misses it.

If the phone lives in a case, put the sticker on the phone itself and the case
back over it, so it can't get peeled off in a bag. Signal goes through plastic,
leather, and silicone without any trouble.

---

## 4. Two ways to open the app

| Event type     | Open this      | What the customer sees                                     |
| -------------- | -------------- | ---------------------------------------------------------- |
| **Paid** event | `/order?pay=1` | Payment screen after Send: price, QR, tap-under arrow      |
| **Free** event | `/order`       | Today's short "order sent" confirmation, gone in 3 seconds |

Both are on the home page — **Start Ordering** and **Tap to Pay** — and in the
nine-dot menu in the corner of the kitchen and admin screens. Nothing else about
the app changes: same menu, same kitchen display, same admin.

On the payment screen there's a small, faint **New order** button in the top
right. It's deliberately quiet and out of the way so a customer holding the
phone won't hit it by accident — tap it when you're ready for the next person.
If everyone forgets, the screen resets itself after 60 seconds so a phone left
on a table can't strand the line.

**Coach the customer out loud.** One sentence does it:

> "Slide your phone under mine, screen on."

"Screen on" matters — a phone that's fully asleep with the screen dark won't
read the sticker. Awake and unlocked is best.

---

## 5. Changing the price or the handle

Both live in two places, and **both places have to match**:

1. **The stickers** — rewrite them in NFC Tools with the new link. About 30
   seconds each, unless you locked them read-only, in which case you write fresh
   ones.
2. **The app** — in the Vercel dashboard, under the project's **Settings →
   Environment Variables**:
   - `NEXT_PUBLIC_VENMO_HANDLE` — handle, no `@`
   - `NEXT_PUBLIC_VENMO_PRICE` — price, e.g. `6.00`

   After changing either one, **redeploy** (Vercel's Deployments tab →
   **Redeploy** on the latest one). These two values get baked into the app when
   it's built, so nothing changes on the screen until it rebuilds. Takes about a
   minute.

If either variable is left empty, the whole feature switches off cleanly: the
Tap to Pay buttons disappear from the home page and the menu, and `/order?pay=1`
behaves exactly like a normal free-event order screen. That's the safe default —
nothing half-on.

**A note on business profiles.** You're using a personal Venmo profile today.
Venmo watches personal accounts for business-looking patterns (many small
payments from strangers in one afternoon) and can freeze one. If that ever
becomes a worry, make a Venmo business profile and swap the handle — it's the
30-second sticker rewrite plus the redeploy above, no code involved.

---

## 6. Test before every event

Not paranoia. The part of the Venmo link that prefills the amount and note isn't
officially supported by Venmo — it broke once in March 2024 and came back a few
weeks later. If it ever breaks again, Venmo still opens on your profile and the
customer types the amount themselves, so you never lose the ability to get paid
— but you want to find that out at your kitchen table, not with ten people in
line.

Five minutes, the morning of:

- [ ] **iPhone tap.** Open `/order?pay=1`, place a test order, flip the phone,
      slide an iPhone underneath. A banner appears at the top → tap it → **Venmo
      opens with your handle, the amount, and the note already filled in.**
- [ ] **Android tap.** Same thing with an Android phone if you have one around.
      Android usually skips the banner and opens Venmo straight away.
- [ ] **Scan the QR.** Point a phone's regular camera at the QR code on the
      screen. Same result: Venmo, prefilled. (The QR's note names the actual
      drink, so it'll read "Delo Coffee – Cardamom Latte" rather than plain
      "Delo Coffee." That's expected.)
- [ ] **A phone with no Venmo installed.** It should land on your `venmo.com`
      profile page in the browser, not an error. Borrow a friend's phone once
      and you'll know for good.
- [ ] **Check the price on screen** matches the price on the sticker. This is
      the one that quietly goes wrong after you change a price.

If the amount and note stop prefilling, don't cancel the event — the QR and the
sticker both still open Venmo on your profile, and the payment screen shows the
drink and the price in big readable type right there for the customer to copy.

---

## 7. If a tap doesn't work

| What's happening                    | Try this                                                                                                                                       |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Nothing at all when they tap        | Ask them to wake their screen, then slide **under** your phone, top edge first                                                                 |
| Works on some phones, not others    | Move slowly — about a second of contact. iPhones older than the XS can't read a sticker without opening an app; send those customers to the QR |
| Stopped working on one team phone   | Check for a metal wallet or magnetic mount on the back; move the sticker or use an on-metal one                                                |
| Sticker feels dead everywhere       | Rewrite it in NFC Tools. If writing fails too, the sticker's damaged — use a spare                                                             |
| Venmo opens but nothing's filled in | Fine to continue: read the price off the screen. Note it and re-test after the event                                                           |
| Anything at all, mid-rush           | Point at the QR code and say "scan this" — it's the same link, and cameras never fail                                                          |
