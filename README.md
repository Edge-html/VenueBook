# KNCHS VenueBook

**Your Space, Your Schedule.**

A venue booking system for the **Gymnasium** and **AVR** of Koronadal National
Comprehensive High School. Students request a slot, admins approve it, and
everyone sees the same live calendar.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, TypeScript, and
Firebase (Auth, Firestore, Analytics).

---

## Features

### Landing page
Name, crest logo, tagline, feature cards, facility cards, and a live
"Today's Availability" panel. Calls to action for **Sign In** and
**Create Account**.

### Accounts
- **Create account** — full name, phone number, email, password, grade, section, and school ID photo. A Firebase email verification link must be opened before booking.
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
Full name, grade and section from the profile, month/day/year, typed start/end
times, purpose, attendees, and equipment quantities. Only genuinely open slots are selectable. Submitted requests start
as **Pending** and wait for an admin.

### Admin side (`/admin`)
- **Booking requests** — approve or decline, with an optional note that the
  student receives. View the student's uploaded ID. Cancel or delete.
- **Availability & schedule** — close individual time slots (maintenance, a
  school event, etc.) and reopen them. Closed slots disappear from the booking
  form.
- Stats for pending requests and today's approvals.
- Daily, weekly, and monthly booking reports with CSV export; admin action history; new venues; venue-specific admin accounts.
- School calendar editor for the active school year, holidays, and one-off closures.

### Email verification

Firebase Authentication sends the verification link directly, so registration does not need Resend, a custom sending domain, a Firebase service-account key, or OTP secrets. In Firebase Console, enable **Email/Password** under Authentication → Sign-in method and add the deployed Vercel hostname (for example, `knchs-venuebook.vercel.app`) under Authentication → Settings → Authorized domains. The app returns students to `/verify-email` after Firebase verifies the link. Deploy the updated `firestore.rules` so bookings require Firebase's verified-email claim; accounts already verified with the previous code flow remain eligible.

### Firestore deployment

GitHub Actions deploys Firestore rules and indexes when those files change on `main`. Add a repository secret named `FIREBASE_SERVICE_ACCOUNT_JSON` in GitHub → Settings → Secrets and variables → Actions. Its value must be the complete service-account JSON for a service account with permission to deploy Firestore rules and indexes. Check the **Actions** tab after a Firestore change; a green **Deploy Firestore configuration** run means the live database matches this repository.

The main administrator can edit the current school year, holidays, and school closure dates in Admin Console → School calendar. The same live calendar is used by the student booking form and enforced by Firestore rules.

Approved reservations can be downloaded as calendar events from My Reservations. Students can enable browser alerts from Notifications; those desktop alerts are delivered while VenueBook is open. In-app notifications remain available in the app.

School ID images are visible to the student, the main administrator, and venue admins for facilities the student has requested. Students can remove their saved ID image from My Profile; doing so also removes it from prior booking records and requires uploading it again before booking. The school should set its retention period in its privacy policy.

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

**Put your photos in [`public/images/`](public/images/) using these file names:**

| File                 | Where it appears           |
| -------------------- | -------------------------- |
| `knchs-building.jpg` | Landing page hero backdrop |
| `gymnasium.jpg`      | Gymnasium card             |
| `avr.jpg`            | AVR card                   |

That is the whole process — no code changes. The folder is scanned when the
site builds, so a file that isn't there is never requested (no broken-image
errors in the console) and the bundled placeholder in
`public/images/placeholders/` is used instead. Add them one at a time; each is
picked up on the next deploy.

Recommended sizes and formats are in
[`public/images/README.md`](public/images/README.md).

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

With the Firebase CLI logged in (`firebase login`, then `firebase use
simple-note-app-e9e59`), deploy all of them with:

```bash
npm install -g firebase-tools
firebase deploy --only firestore:rules,firestore:indexes
```

Or paste `firestore.rules` into the console under **Rules**, and create the two
composite indexes by hand under **Firestore → Indexes → Add index**:

| Collection | Fields |
| --- | --- |
| `bookings` | `userId` Ascending, `createdAt` Descending |
| `notifications` | `uid` Ascending, `createdAt` Descending |

Those two back **My Reservations** and **Notifications**; without them those
pages will show a "missing index" error. Everything else uses equality-only
filters, which Firestore's automatic single-field indexes already cover.

### 4. School ID photos — no setup needed

ID photos are stored as bytes in a Firestore collection (`idPhotos`), not in
Cloud Storage. Cloud Storage requires the **Blaze (pay-as-you-go) billing
plan**, which this project does not need: Firestore is already provisioned and
its free tier (1 GiB stored, 50k reads/day) is more than enough for a school.

Because a Firestore document caps at 1 MiB, uploads are limited to **700 KB**.
The upload limit is enforced both in the client and in `firestore.rules`.

To switch back to Cloud Storage later, upgrade the project to Blaze and move
the upload helpers in `src/lib/data.ts` back onto the Storage SDK.

### 5. Add your production domain

Firebase console → **Authentication** → **Settings** → **Authorized domains**
→ add your Vercel domain, otherwise sign-in fails in production.

### 6. Make yourself an admin

Sign up through the site normally — every new account is created as a
**student**. Then promote yourself in the Firebase console:

1. Firebase console → **Firestore Database** → **Data** → `users`
2. Open the document whose email is yours
3. Change `role` from `student` to `admin`
4. Sign out and sign back in — the **Admin console** link appears in the header

There is deliberately no environment variable for this. Any list of admin emails
shipped to the browser can be read by a visitor, who could then register with
one of those addresses and grant themselves the ability to approve their own
bookings. The rules enforce it instead: a new account may only ever be created
with `role: "student"`, and only an existing admin can change anyone's role.

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
  startTime    "HH:mm" 24-hour, e.g. "09:00"
  endTime      "HH:mm" 24-hour, e.g. "12:00"
  status       "pending" | "approved" | "rejected" | "cancelled"
  userId, fullName, grade, section
  idPhotoUrl   id of the idPhotos document, or null
  purpose, attendees, notes
  createdAt, reviewedAt, reviewedBy, adminNote

idPhotos/{photoId}
  ownerId, contentType, size, data (bytes, ≤ 700 KB), uploadedAt

blockedSlots/{facilityId__date__blockId}
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

Admin rights are **not** environment-driven — they are set on the user document
in Firestore. Opening hours, time blocks, facilities and grades live in
`src/lib/constants.ts`; section is typed freely by the student. The site
timezone is the browser's; adjust `src/lib/dates.ts` if you need to pin it to
Asia/Manila.
