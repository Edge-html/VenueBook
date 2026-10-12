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

> **Do these six steps in order.** Skipping step 1 produces
> `auth/configuration-not-found` on the sign-up page. Skipping step 3 produces
> `Missing or insufficient permissions` on every screen, because Firestore's
> default rules deny all reads and writes.

The web config already points at your project in `src/lib/firebase.ts`, and every
field can be overridden with a `NEXT_PUBLIC_FIREBASE_*` variable.

### 1. Enable Email/Password authentication

Firebase console → **Authentication** → **Sign-in method** → **Email/Password**
→ **Enable** → **Save**.

Without this there is no way to create an account, because Firebase has no
email/password provider to sign up against. Phone sign-in then works too — the
number is matched against Firestore to find the email behind it, so no SMS
provider is required.

### 2. Create the Firestore database

Firebase console → **Firestore Database** → **Create database** → pick a region
near the Philippines → start in **production mode**.

### 3. Deploy the security rules and indexes

The rule and index files are included:

- `firestore.rules` → Firestore security rules
- `firestore.indexes.json` → composite indexes
- `storage.rules` → Storage security rules

With the Firebase CLI logged in (`firebase login`, then `firebase use
simple-note-app-e9e59`), deploy all of them with:

```bash
npm install -g firebase-tools
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Or paste `firestore.rules` and `storage.rules` into the console under
**Rules**, and create the two composite indexes by hand under **Firestore →
Indexes → Add index**:

| Collection | Fields |
| --- | --- |
| `bookings` | `userId` Ascending, `createdAt` Descending |
| `notifications` | `uid` Ascending, `createdAt` Descending |

Those two back **My Reservations** and **Notifications**; without them those
pages will show a "missing index" error. Everything else uses equality-only
filters, which Firestore's automatic single-field indexes already cover.

### 4. Enable Storage

Firebase console → **Storage** → **Get started**. Needed for school ID photos.

### 5. Add your production domain

Firebase console → **Authentication** → **Settings** → **Authorized domains**
→ add your Vercel domain, otherwise sign-in fails in production.

### 6. Create your admin account

Add your email to `NEXT_PUBLIC_ADMIN_EMAILS` in **Vercel → Settings →
Environment Variables**, then sign up through the site:

```
NEXT_PUBLIC_ADMIN_EMAILS=solanaian53@gmail.com
```

Accounts on that list are written to Firestore with `role: "admin"` on first
sign-in, and the **Admin console** link appears in the header.

> `NEXT_PUBLIC_*` values are compiled into the JavaScript bundle at **build**
> time. Setting it only in a local `.env.local` has no effect on the deployed
> site — add it in Vercel, then **Redeploy** the project.

To promote an existing account instead: Firestore → `users` → the document →
set `role` to `admin`, then have that person sign out and back in.

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

Two queries need composite indexes (`bookings` by userId + createdAt, and
`notifications` by uid + createdAt) — they ship in
`firestore.indexes.json`. The rest use equality-only filters, which Firestore's
automatic single-field indexes already cover.

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