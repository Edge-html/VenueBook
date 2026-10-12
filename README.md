# KNCHS VenueBook

**Your Space, Your Schedule.**

A venue booking system for the **Gymnasium** and **AVR** of Koronadal National
Comprehensive High School. Students request a slot, admins approve it, and
everyone sees the same live calendar.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript, and
Firebase (Auth, Firestore, Storage, Analytics).

---

## Features

### Landing page
Name, crest logo, tagline, feature cards, facility cards, and a live
"Today's Availability" panel. Calls to action for **Sign In** and
**Create Account**.

### Accounts
- **Create account** — full name, phone number, email, password.
- **Sign in** — with either your email address *or* your phone number.
- Forgot-password reset by email or phone.
- Roles are `student` and `admin`.

### Student side
| Feature | What it does |
| --- | --- |
| **Book a Facility** | Pick Gymnasium or AVR, then fill in the form. |
| **Check Availability** | Month calendar; green = free, red = booked, amber = pending, grey = closed. |
| **My Reservations** | Every request, filterable by upcoming / past / all, with cancel. |
| **Notifications** | Approval and decline updates from admins. |

### Booking form
Full name, grade, section, school ID photo (uploaded to Storage), date, and
time slot. Only genuinely open slots are selectable. Submitted requests start
as **Pending** and wait for an admin.

### Admin side (`/admin`)
- **Booking requests** — approve or decline, with an optional note that the
  student receives. View the student's uploaded ID. Cancel or delete.
- **Availability & schedule** — close individual time slots (maintenance, a
  school event, etc.) and reopen them. Closed slots disappear from the booking
  form.
- Stats for pending requests and today's approvals.

---

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint
```

### Images

Drop photos into `public/images/` using these exact filenames — the site
renders a styled placeholder for anything missing, so you can add them one at
a time:

- `knchs-building.jpg` — landing hero
- `gymnasium.jpg` — gymnasium card
- `avr.jpg` — AVR card

See `public/images/README.md` for recommended sizes.

---

## Firebase setup

The web config lives in `src/lib/firebase.ts` with your project already filled
in, so the app runs immediately. Every field can be overridden with a
`NEXT_PUBLIC_FIREBASE_*` variable — copy `.env.example` to `.env.local` if you
prefer.

### 1. Enable Authentication

Firebase console → **Authentication** → **Sign-in method** → enable
**Email/Password**.

Phone sign-in is handled by looking the number up in Firestore and using the
email behind it, so no SMS provider is needed.

### 2. Create the Firestore database

Firebase console → **Firestore Database** → Create database.

### 3. Deploy the security rules

Paste the included rule files into the Firebase console:

- `firestore.rules` → **Firestore** → Rules
- `storage.rules` → **Storage** → Rules

```bash
firebase deploy --only firestore:rules,storage
```

### 4. Enable Storage

Firebase console → **Storage** → Get started. Needed for school ID photos.

### 5. Add your production domain

Firebase console → **Authentication** → **Settings** → **Authorized domains**
→ add your Vercel domain, otherwise sign-in will fail in production.

### 6. Make yourself an admin

Set `NEXT_PUBLIC_ADMIN_EMAILS` in `.env.local` (and in Vercel) to a
comma-separated list of emails:

```
NEXT_PUBLIC_ADMIN_EMAILS=admin@knchs.edu.ph
```

Anyone on that list is created as an `admin` the first time they sign in.

To promote an account later, open Firestore → `users` → the document → set
`role` to `admin`.

---

## Firestore structure

```
users/{uid}
  fullName, email, phone, role, createdAt

bookings/{bookingId}
  facilityId   "gymnasium" | "avr"
  date         "YYYY-MM-DD"
  timeSlot     "07-09" | "09-11" | "11-13" | "13-15" | "15-17" | "17-19"
  status       "pending" | "approved" | "rejected" | "cancelled"
  userId, fullName, grade, section
  idPhotoUrl, purpose, attendees, notes
  createdAt, reviewedAt, reviewedBy, adminNote

blockedSlots/{facilityId__date__timeSlot}
  facilityId, date, timeSlot, reason, createdBy, createdAt

notifications/{id}
  uid, title, body, kind, bookingId, read, createdAt
```

The composite queries used by the calendar are equality-only, so Firestore's
automatic single-field indexes are sufficient — no manual indexes required.

---

## Deploying to Vercel

1. Push the repository to GitHub (this repo).
2. In Vercel: **Add New** → **Project** → import the repo. The defaults are
   correct; no overrides needed.
3. Add the environment variables from `.env.example` under **Settings →
   Environment Variables** (optional — the defaults already point at the right
   Firebase project).
4. Deploy, then add the resulting domain to Firebase's authorized domains
   (step 5 above).

---

## Configuration

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web config (optional; defaults are set) |
| `NEXT_PUBLIC_ADMIN_EMAILS` | Emails that become admins on first sign-in |

Booking windows, time slots, facilities, grades and sections all live in
`src/lib/constants.ts`. The site timezone is the browser's; adjust
`src/lib/dates.ts` if you need to pin it to Asia/Manila.