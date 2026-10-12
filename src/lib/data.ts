import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase";
import { MAX_ID_PHOTO_BYTES, TIME_SLOTS } from "./constants";
import type {
  AppNotification,
  BlockedSlot,
  Booking,
  BookingStatus,
  FacilityId,
  SlotState,
} from "./types";

/* ── Firestore collections ─────────────────────────────────────────────── */

export const COLLECTIONS = {
  users: "users",
  bookings: "bookings",
  blockedSlots: "blockedSlots",
  notifications: "notifications",
} as const;

/** Deterministic key so a slot can only be blocked once. */
export function blockedSlotId(facilityId: string, date: string, timeSlot: string) {
  return `${facilityId}__${date}__${timeSlot}`;
}

/* ── ID photo upload ───────────────────────────────────────────────────── */

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateIdPhoto(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Please upload a JPG, PNG, or WEBP image.";
  }
  if (file.size > MAX_ID_PHOTO_BYTES) {
    return "Image is too large. Please keep it under 5 MB.";
  }
  return null;
}

export async function uploadIdPhoto(file: File, uid: string): Promise<string> {
  const error = validateIdPhoto(file);
  if (error) throw new Error(error);

  const extension = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `id-photos/${uid}/${Date.now()}.${extension}`;
  const objectRef = ref(storage, path);

  await uploadBytes(objectRef, file, { contentType: file.type });
  return getDownloadURL(objectRef);
}

export async function removeUploadedIdPhoto(url: string | null): Promise<void> {
  if (!url) return;
  try {
    await deleteObject(ref(storage, url));
  } catch {
    // The file may already be gone; nothing useful to do about it.
  }
}

/* ── Availability ──────────────────────────────────────────────────────── */

export interface DaySnapshot {
  /** Slot id → state. Every slot in TIME_SLOTS is present. */
  slots: Record<string, SlotState>;
  bookings: Booking[];
  blocks: BlockedSlot[];
}

function emptySlots(): Record<string, SlotState> {
  return Object.fromEntries(TIME_SLOTS.map((s) => [s.id, "available" as SlotState]));
}

/**
 * Loads one facility-day and folds bookings + blocks into a single status per
 * slot. An approved booking always wins; a pending booking shows as pending so
 * students can see it is spoken for.
 */
export async function getDayAvailability(
  facilityId: FacilityId,
  date: string,
): Promise<DaySnapshot> {
  const bookingQuery = query(
    collection(db, COLLECTIONS.bookings),
    where("facilityId", "==", facilityId),
    where("date", "==", date),
  );

  const blockQuery = query(
    collection(db, COLLECTIONS.blockedSlots),
    where("facilityId", "==", facilityId),
    where("date", "==", date),
  );

  const [bookingSnap, blockSnap] = await Promise.all([
    getDocs(bookingQuery),
    getDocs(blockQuery),
  ]);

  const bookings = bookingSnap.docs.map(toBooking);
  const blocks = blockSnap.docs.map(toBlockedSlot);
  const slots = emptySlots();

  for (const block of blocks) {
    if (slots[block.timeSlot] !== "booked") slots[block.timeSlot] = "blocked";
  }

  for (const booking of bookings) {
    const current = slots[booking.timeSlot];
    if (booking.status === "approved") {
      slots[booking.timeSlot] = "booked";
    } else if (booking.status === "pending" && current === "available") {
      slots[booking.timeSlot] = "pending";
    }
  }

  return { slots, bookings, blocks };
}

/** Firestore caps `in` at 30 values, so long ranges are chunked. */
const IN_CHUNK = 25;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Calendar-sized read: two `in` queries per 25 days instead of two per day.
 * Returns `date → slot id → state`, with every requested date present.
 */
export async function getMonthAvailability(
  facilityId: FacilityId,
  dates: string[],
): Promise<Record<string, Record<string, SlotState>>> {
  if (dates.length === 0) return {};

  const readByDate = async (name: string) => {
    const results = await Promise.all(
      chunk(dates, IN_CHUNK).map((batch) =>
        getDocs(
          query(
            collection(db, name),
            where("facilityId", "==", facilityId),
            where("date", "in", batch),
          ),
        ),
      ),
    );
    return results.flatMap((snap) => snap.docs);
  };

  const [bookingDocs, blockDocs] = await Promise.all([
    readByDate(COLLECTIONS.bookings),
    readByDate(COLLECTIONS.blockedSlots),
  ]);

  const bookings = bookingDocs.map(toBooking);
  const blocks = blockDocs.map(toBlockedSlot);

  const result: Record<string, Record<string, SlotState>> = {};
  for (const date of dates) {
    const slots = emptySlots();

    for (const block of blocks) {
      if (block.date !== date) continue;
      if (slots[block.timeSlot] !== "booked") slots[block.timeSlot] = "blocked";
    }

    for (const booking of bookings) {
      if (booking.date !== date) continue;
      const current = slots[booking.timeSlot];
      if (booking.status === "approved") {
        slots[booking.timeSlot] = "booked";
      } else if (booking.status === "pending" && current === "available") {
        slots[booking.timeSlot] = "pending";
      }
    }

    result[date] = slots;
  }

  return result;
}

/* ── Bookings ──────────────────────────────────────────────────────────── */

export interface NewBookingInput {
  facilityId: FacilityId;
  date: string;
  timeSlot: string;
  fullName: string;
  grade: string;
  section: string;
  idPhotoUrl: string | null;
  purpose: string;
  attendees: number;
  notes: string;
  userId: string;
}

export async function createBooking(input: NewBookingInput): Promise<string> {
  const created = await addDoc(collection(db, COLLECTIONS.bookings), {
    ...input,
    status: "pending" satisfies BookingStatus,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function getBookingsForUser(uid: string): Promise<Booking[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.bookings),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
      limit(100),
    ),
  );
  return snap.docs.map(toBooking);
}

export async function getAllBookings(): Promise<Booking[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.bookings), orderBy("createdAt", "desc"), limit(300)),
  );
  return snap.docs.map(toBooking);
}

export async function setBookingStatus(
  bookingId: string,
  status: Extract<BookingStatus, "approved" | "rejected">,
  admin: { uid: string; name: string },
  note = "",
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.bookings, bookingId), {
    status,
    reviewedAt: serverTimestamp(),
    reviewedBy: admin.name,
    adminNote: note.trim() || null,
  });
}

export async function cancelBooking(bookingId: string, byAdmin = false): Promise<void> {
  // A student's cancellation may only touch `status` — the security rules
  // reject any other changed field, so `reviewedAt` is written by admins only.
  await updateDoc(
    doc(db, COLLECTIONS.bookings, bookingId),
    byAdmin
      ? { status: "cancelled" satisfies BookingStatus, reviewedAt: serverTimestamp() }
      : { status: "cancelled" satisfies BookingStatus },
  );
}

/** Frees the slot only when nothing else still holds it. */
async function isSlotStillHeld(
  facilityId: FacilityId,
  date: string,
  timeSlot: string,
  excludeBookingId: string,
): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.bookings),
      where("facilityId", "==", facilityId),
      where("date", "==", date),
      where("timeSlot", "==", timeSlot),
    ),
  );

  return snap.docs.some((d) => {
    if (d.id === excludeBookingId) return false;
    const status = (d.data() as DocumentData).status as BookingStatus;
    return status === "approved" || status === "pending";
  });
}

/* ── Admin schedule control ────────────────────────────────────────────── */

export async function blockSlot(
  facilityId: FacilityId,
  date: string,
  timeSlot: string,
  reason: string,
  adminUid: string,
): Promise<void> {
  await setDoc(
    doc(db, COLLECTIONS.blockedSlots, blockedSlotId(facilityId, date, timeSlot)),
    {
      facilityId,
      date,
      timeSlot,
      reason: reason.trim() || "Closed by admin",
      createdAt: serverTimestamp(),
      createdBy: adminUid,
    },
  );
}

export async function unblockSlot(facilityId: FacilityId, date: string, timeSlot: string) {
  await deleteDoc(
    doc(db, COLLECTIONS.blockedSlots, blockedSlotId(facilityId, date, timeSlot)),
  );
}

export async function getBlocks(facilityId: FacilityId, date: string): Promise<BlockedSlot[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.blockedSlots),
      where("facilityId", "==", facilityId),
      where("date", "==", date),
    ),
  );
  return snap.docs.map(toBlockedSlot);
}

/**
 * Drops a booking and frees the slot, but only if no other active booking
 * remains on it. Prevents an approved clash from being wiped out wholesale.
 */
export async function removeBooking(booking: Booking): Promise<void> {
  if (await isSlotStillHeld(booking.facilityId, booking.date, booking.timeSlot, booking.id)) {
    await cancelBooking(booking.id, true);
    return;
  }
  await removeUploadedIdPhoto(booking.idPhotoUrl);
  await deleteDoc(doc(db, COLLECTIONS.bookings, booking.id));
}

/* ── Notifications ─────────────────────────────────────────────────────── */

export async function getNotifications(uid: string): Promise<AppNotification[]> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.notifications),
      where("uid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(50),
    ),
  );
  return snap.docs.map(toNotification);
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.notifications),
      where("uid", "==", uid),
      where("read", "==", false),
    ),
  );
  await Promise.all(
    snap.docs.map((d) => updateDoc(d.ref, { read: true })),
  );
}

/**
 * Best-effort fan-out to admins. A failure here must never roll back the
 * approval the admin just made, hence the swallowed error.
 */
export async function notifyAdmins(
  title: string,
  body: string,
  kind: AppNotification["kind"],
  bookingId: string | null,
): Promise<void> {
  try {
    const adminSnap = await getDocs(
      query(collection(db, COLLECTIONS.users), where("role", "==", "admin")),
    );

    await Promise.all(
      adminSnap.docs.map((adminDoc) =>
        addDoc(collection(db, COLLECTIONS.notifications), {
          uid: adminDoc.id,
          title,
          body,
          kind,
          bookingId,
          read: false,
          createdAt: serverTimestamp(),
        }),
      ),
    );
  } catch {
    // Notification delivery is advisory.
  }
}

/** Tells a student their request was approved, declined, or cancelled. */
export async function notifyUser(
  uid: string,
  title: string,
  body: string,
  kind: AppNotification["kind"],
  bookingId: string | null,
): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTIONS.notifications), {
      uid,
      title,
      body,
      kind,
      bookingId,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Notification delivery is advisory.
  }
}

/* ── Mapping ───────────────────────────────────────────────────────────── */

function toBooking(snap: QueryDocumentSnapshot<DocumentData>): Booking {
  const data = snap.data() as DocumentData;
  return {
    id: snap.id,
    facilityId: data.facilityId as FacilityId,
    date: data.date as string,
    timeSlot: data.timeSlot as string,
    status: data.status as BookingStatus,
    userId: data.userId as string,
    fullName: data.fullName as string,
    grade: data.grade as string,
    section: data.section as string,
    idPhotoUrl: (data.idPhotoUrl as string | null) ?? null,
    purpose: (data.purpose as string) ?? "",
    attendees: (data.attendees as number) ?? 0,
    notes: (data.notes as string) ?? "",
    createdAt: data.createdAt ?? null,
    reviewedAt: data.reviewedAt ?? null,
    reviewedBy: (data.reviewedBy as string | null) ?? null,
    adminNote: (data.adminNote as string | null) ?? null,
  };
}

function toBlockedSlot(snap: QueryDocumentSnapshot<DocumentData>): BlockedSlot {
  const data = snap.data() as DocumentData;
  return {
    id: snap.id,
    facilityId: data.facilityId as FacilityId,
    date: data.date as string,
    timeSlot: data.timeSlot as string,
    reason: (data.reason as string) ?? "",
    createdAt: data.createdAt ?? null,
    createdBy: (data.createdBy as string | null) ?? null,
  };
}

function toNotification(snap: QueryDocumentSnapshot<DocumentData>): AppNotification {
  const data = snap.data() as DocumentData;
  return {
    id: snap.id,
    uid: data.uid as string,
    title: data.title as string,
    body: (data.body as string) ?? "",
    kind: (data.kind as AppNotification["kind"]) ?? "system",
    bookingId: (data.bookingId as string | null) ?? null,
    read: Boolean(data.read),
    createdAt: data.createdAt ?? null,
  };
}