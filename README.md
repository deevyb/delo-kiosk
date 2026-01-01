# Delo Coffee Kiosk

A minimal iPad ordering system for Delo Coffee pop-up events. Customers place single-drink orders using their name, baristas see orders in real-time, and admins manage the menu.

**Live Demo:** [delo-kiosk.vercel.app](https://delo-kiosk-buwhagfrm-deevys-projects.vercel.app)

---

## Features

### Customer Ordering (`/order`)
- Browse menu as a visual grid
- Select milk type and temperature (where applicable)
- Enter name and submit order
- Confirmation with order details

### Kitchen Display (`/kitchen`)
- Real-time order queue (no refresh needed)
- One-tap to mark orders ready or cancel
- Order counts and time tracking
- Separate sections for placed vs. ready orders

### Admin Panel (`/admin`)
- Passcode-protected access
- Toggle menu items on/off
- Manage modifier options (milk types, temperatures)
- Export orders as CSV by date range

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Database | Supabase (PostgreSQL) |
| Real-time | Supabase Realtime |
| Hosting | Vercel |

---

## Project Structure

```
delo-kiosk/
├── app/
│   ├── order/        # Customer ordering screen
│   ├── kitchen/      # Barista display
│   ├── admin/        # Admin panel
│   ├── layout.tsx    # Root layout with fonts
│   └── globals.css   # Tailwind + Delo brand styles
├── lib/
│   └── supabase.ts   # Database client + types
├── components/       # Shared UI components
└── docs/
    ├── CLAUDE.md     # Project guide (for AI assistants)
    └── TECHNICAL.md  # Technical documentation
```

---

## Local Development

### Prerequisites
- Node.js 18+
- npm
- A Supabase project (or use the existing one)

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/deevyb/delo-kiosk.git
   cd delo-kiosk
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ADMIN_PASSCODE=your_passcode
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

---

## Database Schema

Three tables power the app:

- **menu_items** — Drinks with modifier configuration
- **modifiers** — Milk types and temperature options
- **orders** — Customer orders with status tracking

See [TECHNICAL.md](./TECHNICAL.md) for full schema details.

---

## Deployment

The app auto-deploys to Vercel when you push to `main`. Environment variables are configured in Vercel dashboard.

---

## Design

Delo Coffee's brand is inspired by the *delo* — a traditional Indian courtyard where strangers become friends. The app uses:

- **Colors:** Maroon (#921C12), Cream (#F9F6EE), Navy (#000024)
- **Typography:** Yatra One, Bricolage Grotesque, Roboto Mono
- **Aesthetic:** Warm, generous spacing, large touch targets

See [Delo Coffee Brand Identity.md](./Delo%20Coffee%20Brand%20Identity.md) for full brand guidelines.

---

## License

Private project for Delo Coffee.
