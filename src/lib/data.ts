import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { MAX_ID_PHOTO_BYTES, TIME_BLOCKS, BLOCK_BY_ID } from "./constants";
import { bookingInstants } from "./dates";
import { formatTimeRange, fromMinutes, overlaps, toMinutes } from "./time";
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
  idPhotos: "idPhotos",
} as const;

/** Deterministic key so a slot can only be blocked once. */
export function blockedSlotId(facilityId: string, date: string, timeSlot: string) {
  return `${facilityId}__${date}__${timeSlot}`;
}

/* ── ID photo ──────────────────────────────────────────────────────────── */

/**
 * School IDs are stored as bytes in Firestore rather than Cloud Storage.
 *
 * Cloud Storage requires the Blaze (pay-as-you-go) billing plan, which is not
 * an option for this project, whereas Firestore is already provisioned and has
 * a generous free tier. Firestore documents cap at 1 MiB, so uploads are
 * validated against MAX_ID_PHOTO_BYTES and the client downscales beforehand.
 */
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateIdPhoto(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Please upload a JPG, PNG, or WEBP image.";
  }
  if (file.size > MAX_ID_PHOTO_BYTES) {
    return `Image is too large. Please keep it under ${Math.round(MAX_ID_PHOTO_BYTES / 1024)} KB.`;
  }
  return null;
}

export async function uploadIdPhoto(file: File, uid: string): Promise<string> {
  const error = validateIdPhoto(file);
  if (error) throw new Error(error);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const id = `${uid}_${Date.now()}`;

  await setDoc(doc(db, COLLECTIONS.idPhotos, id), {
    ownerId: uid,
    contentType: file.type,
    size: bytes.length,
    data: bytes,
    uploadedAt: serverTimestamp(),
  });

  return id;
}

export async function fetchIdPhoto(
  id: string,
): Promise<{ url: string; revoke: () => void } | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.idPhotos, id));
  if (!snap.exists()) return null;

  const { contentType, data } = snap.data() as {
    contentType: string;
    data: Uint8Array;
  };

  const blob = new Blob([data as BlobPart], { type: contentType || "image/jpeg" });
  const url = URL.createObjectURL(blob);

  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export async function removeUploadedIdPhoto(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await deleteDoc(doc(db, COLLECTIONS.idPhotos, id));
  } catch {
    // The photo may already be gone; nothing useful to do about it.
  }
}

/* ── Availability ──────────────────────────────────────────────────────── */

export interface DaySnapshot {
  /** Block id → state. Every block in TIME_BLOCKS is present. */
  slots: Record<string, SlotState>;
  bookings: Booking[];
  blocks: BlockedSlot[];
}

function emptySlots(): Record<string, SlotState> {
  return Object.fromEntries(TIME_BLOCKS.map((b) => [b.id, "available" as SlotState]));
}

/**
 * Folds a day's bookings and admin closures into one state per fixed block.
 *
 * Because bookings are free-form (9 AM–12 PM, say), a block is marked by
 * *overlap* rather than equality — a block overlapping an approved booking is
 * "booked" for its whole span. Approved beats pending beats closed.
 */
function foldIntoBlocks(
  bookings: Booking[],
  blocks: BlockedSlot[],
  date: string,
): Record<string, SlotState> {
  const slots = emptySlots();

  const dayBlocks = blocks.filter((b) => b.date === date);
  const dayBookings = bookings.filter((b) => b.date === date);

  for (const block of TIME_BLOCKS) {
    let state: SlotState = "available";

    for (const closure of dayBlocks) {
      const closureBlock = BLOCK_BY_ID[closure.timeSlot];
      if (!closureBlock) continue;
      if (!overlaps(block.startMin, block.endMin, closureBlock.startMin, closureBlock.endMin)) {
        continue;
      }
      if (state === "available") state = "blocked";
    }

    for (const booking of dayBookings) {
      if (booking.status !== "approved" && booking.status !== "pending") continue;

      const startMin = toMinutes(booking.startTime);
      const endMin = toMinutes(booking.endTime);
      if (startMin === null || endMin === null) continue;
      if (!overlaps(block.startMin, block.endMin, startMin, endMin)) continue;

      if (booking.status === "approved") {
        state = "booked";
        break;
      }
      if (state === "available") state = "pending";
    }

    slots[block.id] = state;
  }

  return slots;
}

/**
 * Loads one facility-day and resolves the state of every block.
 * An approved booking always wins; a pending booking shows as pending so
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

  return { slots: foldIntoBlocks(bookings, blocks, date), bookings, blocks };
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
 * Returns `date → block id → state`, with every requested date present.
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
    result[date] = foldIntoBlocks(bookings, blocks, date);
  }

  return result;
}

/**
 * Checks a requested range against everything already on the day: returns the
 * first hard conflict (approved booking or admin closure) and whether a pending
 * request already overlaps. `ignoreBookingId` excludes a booking from itself.
 */
export async function findRangeConflicts(
  facilityId: FacilityId,
  date: string,
  startTime: string,
  endTime: string,
  ignoreBookingId?: string,
): Promise<{ hard: string | null; pending: string | null }> {
  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);
  if (startMin === null || endMin === null) {
    return { hard: "That time is not valid.", pending: null };
  }

  const [day, blocks] = await Promise.all([
    getDayAvailability(facilityId, date),
    getBlocks(facilityId, date),
  ]);

  const { bookings } = day;

  let hard: string | null = null;
  let pending: string | null = null;

  for (const closure of blocks) {
    if (hard) break;
    const closureBlock = BLOCK_BY_ID[closure.timeSlot];
    if (!closureBlock) continue;
    if (overlaps(startMin, endMin, closureBlock.startMin, closureBlock.endMin)) {
      hard = `The venue is closed for ${closure.reason.toLowerCase()} during part of that time.`;
    }
  }

  for (const booking of bookings) {
    if (booking.id === ignoreBookingId) continue;

    const bookingStart = toMinutes(booking.startTime);
    const bookingEnd = toMinutes(booking.endTime);
    if (bookingStart === null || bookingEnd === null) continue;
    if (!overlaps(startMin, endMin, bookingStart, bookingEnd)) continue;

    const range = formatTimeRange(booking.startTime, booking.endTime);

    if (booking.status === "approved") {
      if (!hard) hard = `That time overlaps an approved booking (${range}).`;
    } else if (booking.status === "pending" && !pending) {
      pending = `Someone has a request pending for ${range}. You can still submit, but an admin may only approve one.`;
    }
  }

  // A window that has already begun can never be booked.
  const { startAt } = bookingInstants(date, startTime, endTime);
  if (startAt && startAt.getTime() <= Date.now()) {
    hard = "That time has already passed. Please pick a start time in the future.";
  }

  return { hard, pending };
}

/* ── Bookings ──────────────────────────────────────────────────────────── */

export interface NewBookingInput {
  facilityId: FacilityId;
  date: string;
  /** "HH:mm", 24-hour. */
  startTime: string;
  /** "HH:mm", 24-hour. Must be after `startTime`. */
  endTime: string;
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
  const { startTime, endTime, date, ...rest } = input;

  // Absolute instants alongside the wall-clock strings: the security rules can
  // compare these against `request.time`, which rules out a past booking even
  // if someone bypasses the form.
  const { startAt, endAt } = bookingInstants(date, startTime, endTime);

  const created = await addDoc(collection(db, COLLECTIONS.bookings), {
    ...rest,
    date,
    startTime,
    endTime,
    startAt: startAt ? Timestamp.fromDate(startAt) : null,
    endAt: endAt ? Timestamp.fromDate(endAt) : null,
    status: "pending" satisfies BookingStatus,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

/** The student closes out their own booking, or an admin does it for them. */
export async function markBookingCompleted(
  bookingId: string,
  byAdmin = false,
): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.bookings, bookingId), {
    status: "completed" satisfies BookingStatus,
    completedAt: serverTimestamp(),
    ...(byAdmin ? { reviewedAt: serverTimestamp() } : {}),
  });
}

/** Admin releases a slot because the student never arrived. */
export async function markBookingNoShow(bookingId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTIONS.bookings, bookingId), {
    status: "no_show" satisfies BookingStatus,
    noShowAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
  });
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

/** True when any *other* active booking still overlaps this one. */
async function isRangeStillHeld(
  facilityId: FacilityId,
  date: string,
  startTime: string,
  endTime: string,
  excludeBookingId: string,
): Promise<boolean> {
  const startMin = toMinutes(startTime);
  const endMin = toMinutes(endTime);
  if (startMin === null || endMin === null) return false;

  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.bookings),
      where("facilityId", "==", facilityId),
      where("date", "==", date),
    ),
  );

  return snap.docs.some((d) => {
    if (d.id === excludeBookingId) return false;

    const data = d.data() as DocumentData;
    const status = data.status as BookingStatus;
    // Completed, no-show, cancelled and declined bookings release the slot.
    if (status !== "approved" && status !== "pending") return false;

    const other = parseBooking(d.id, data);
    const otherStart = toMinutes(other.startTime);
    const otherEnd = toMinutes(other.endTime);
    if (otherStart === null || otherEnd === null) return false;

    return overlaps(startMin, endMin, otherStart, otherEnd);
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
  if (await isRangeStillHeld(booking.facilityId, booking.date, booking.startTime, booking.endTime, booking.id)) {
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
  return parseBooking(snap.id, snap.data() as DocumentData);
}

/**
 * Bookings written before free-form times only have a block id, so their exact
 * range is recovered from that block.
 */
function parseBooking(id: string, data: DocumentData): Booking {
  let startTime = (data.startTime as string) ?? "";
  let endTime = (data.endTime as string) ?? "";

  if ((!startTime || !endTime) && data.timeSlot) {
    const block = BLOCK_BY_ID[data.timeSlot as string];
    if (block) {
      startTime ||= fromMinutes(block.startMin);
      endTime ||= fromMinutes(block.endMin);
    }
  }

  return {
    id,
    facilityId: data.facilityId as FacilityId,
    date: data.date as string,
    startTime,
    endTime,
    startAt: (data.startAt as Timestamp | null) ?? null,
    endAt: (data.endAt as Timestamp | null) ?? null,
    timeSlot: (data.timeSlot as string) ?? undefined,
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
    completedAt: (data.completedAt as Timestamp | null) ?? null,
    noShowAt: (data.noShowAt as Timestamp | null) ?? null,
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