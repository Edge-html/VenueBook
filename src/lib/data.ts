import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { MAX_ID_PHOTO_BYTES, TIME_BLOCKS, BLOCK_BY_ID } from "./constants";
import { bookingInstants, DEFAULT_SCHOOL_CALENDAR, schoolDayReason, type SchoolCalendarSettings } from "./dates";
import { formatTimeRange, fromMinutes, inclusiveHourEnd, overlaps, toMinutes } from "./time";
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
  availability: "availability",
  scheduleDays: "scheduleDays",
  blockedSlots: "blockedSlots",
  notifications: "notifications",
  idPhotos: "idPhotos",
  schoolCalendar: "schoolCalendar",
  bookingAudit: "bookingAudit",
  requestAlerts: "requestAlerts",
} as const;

export async function getSchoolCalendar(): Promise<SchoolCalendarSettings> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.schoolCalendar, "current"));
  if (!snapshot.exists()) return DEFAULT_SCHOOL_CALENDAR;
  const data = snapshot.data();
  return {
    schoolYearLabel: String(data.schoolYearLabel ?? DEFAULT_SCHOOL_CALENDAR.schoolYearLabel),
    startDate: String(data.startDate ?? DEFAULT_SCHOOL_CALENDAR.startDate),
    endDate: String(data.endDate ?? DEFAULT_SCHOOL_CALENDAR.endDate),
    closedDates: Array.isArray(data.closedDates) ? data.closedDates.filter((date): date is string => typeof date === "string") : [],
    closedReasons: data.closedReasons && typeof data.closedReasons === "object" ? data.closedReasons as Record<string, string> : {},
  };
}

export async function ensureSchoolCalendar(adminUid: string): Promise<void> {
  const calendarRef = doc(db, COLLECTIONS.schoolCalendar, "current");
  await runTransaction(db, async (transaction) => {
    const current = await transaction.get(calendarRef);
    if (current.exists()) return;
    transaction.set(calendarRef, {
      ...DEFAULT_SCHOOL_CALENDAR,
      updatedAt: serverTimestamp(),
      updatedBy: adminUid,
    });
  });
}

export async function saveSchoolCalendar(settings: SchoolCalendarSettings, adminUid: string): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.schoolCalendar, "current"), {
    ...settings,
    updatedAt: serverTimestamp(),
    updatedBy: adminUid,
  });
}

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
  // Some browsers report an empty MIME type for valid local files. Fall back
  // to the filename extension in that case so a selected PNG/JPG is not
  // rejected by the signup form before Firebase is called.
  const extension = file.name.split(".").pop()?.toLowerCase();
  const supportedExtension = ["jpg", "jpeg", "png", "webp"].includes(extension ?? "");
  const reportedType = file.type.toLowerCase();
  if (!ACCEPTED_IMAGE_TYPES.includes(reportedType) && !(supportedExtension && (!reportedType || reportedType === "application/octet-stream"))) {
    return "Please upload a JPG, PNG, or WEBP image.";
  }
  return null;
}

/** Resize large phone screenshots before storing them in Firestore. */
export async function prepareIdPhoto(file: File): Promise<File> {
  const error = validateIdPhoto(file);
  if (error) throw new Error(error);
  if (file.size <= MAX_ID_PHOTO_BYTES) return file;
  if (typeof createImageBitmap !== "function") {
    throw new Error("This browser cannot resize the image. Please choose a smaller JPG, PNG, or WEBP file.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    for (const maxDimension of [1800, 1500, 1200, 1000, 800]) {
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.84, 0.74, 0.64, 0.54]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= MAX_ID_PHOTO_BYTES) {
          const name = file.name.replace(/\.[^.]+$/, "") || "school-id";
          return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
        }
      }
    }
  } finally {
    bitmap.close();
  }

  throw new Error("We could not reduce this image enough. Please choose a smaller or clearer School ID photo.");
}

export async function uploadIdPhoto(file: File, uid: string): Promise<string> {
  const preparedFile = await prepareIdPhoto(file);

  const bytes = new Uint8Array(await preparedFile.arrayBuffer());
  // Firestore's web SDK rejects Uint8Array values. Store a base64 string while
  // retaining the original byte count for the document size checks.
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  const encodedData = btoa(binary);
  const id = `${uid}_${Date.now()}`;

  await setDoc(doc(db, COLLECTIONS.idPhotos, id), {
    ownerId: uid,
    facilityIds: [],
    contentType: preparedFile.type,
    size: bytes.length,
    data: encodedData,
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
    data: string | number[];
  };

  const imageBytes = typeof data === "string"
    ? Uint8Array.from(atob(data), (character) => character.charCodeAt(0))
    : new Uint8Array(data);
  const blob = new Blob([imageBytes], { type: contentType || "image/jpeg" });
  const url = URL.createObjectURL(blob);

  return { url, revoke: () => URL.revokeObjectURL(url) };
}

export async function removeStudentIdPhoto(uid: string, id: string): Promise<void> {
  const profileRef = doc(db, COLLECTIONS.users, uid);
  const photoRef = doc(db, COLLECTIONS.idPhotos, id);
  await runTransaction(db, async (transaction) => {
    const [profileSnap, photoSnap] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(photoRef),
    ]);
    if (!profileSnap.exists()) throw new Error("Account profile not found.");
    if (photoSnap.exists() && photoSnap.data().ownerId !== uid) throw new Error("This image does not belong to your account.");
    transaction.update(profileRef, { idPhotoUrl: null });
    if (photoSnap.exists()) transaction.delete(photoRef);
  });
}

/* ── Availability ──────────────────────────────────────────────────────── */

export interface DaySnapshot {
  /** Block id → state. Every block in TIME_BLOCKS is present. */
  slots: Record<string, SlotState>;
  bookings: ScheduleEntry[];
  blocks: BlockedSlot[];
}

/** Public schedule fields; personal reservation details stay in `bookings`. */
export type ScheduleEntry = Pick<Booking, "id" | "facilityId" | "date" | "startTime" | "endTime" | "status">;

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
  bookings: ScheduleEntry[],
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
      if (!overlaps(block.startMin, block.endMin, startMin, inclusiveHourEnd(endMin))) continue;

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
    collection(db, COLLECTIONS.availability),
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

  const bookings = bookingSnap.docs.map(toScheduleEntry);
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
  const pending: string | null = null;

  for (const closure of blocks) {
    if (hard) break;
    const closureBlock = BLOCK_BY_ID[closure.timeSlot];
    if (!closureBlock) continue;
    if (overlaps(startMin, inclusiveHourEnd(endMin), closureBlock.startMin, closureBlock.endMin)) {
      hard = `The venue is closed for ${closure.reason.toLowerCase()} during part of that time.`;
    }
  }

  for (const booking of bookings) {
    if (booking.id === ignoreBookingId) continue;

    const bookingStart = toMinutes(booking.startTime);
    const bookingEnd = toMinutes(booking.endTime);
    if (bookingStart === null || bookingEnd === null) continue;
    if (!overlaps(startMin, inclusiveHourEnd(endMin), bookingStart, inclusiveHourEnd(bookingEnd))) continue;

    const range = formatTimeRange(booking.startTime, booking.endTime);

    if (booking.status === "approved") {
      if (!hard) hard = `That time overlaps an approved booking (${range}).`;
    } else if (booking.status === "pending" && !hard) {
      hard = `Someone already has a request pending for ${range}. Please choose another time.`;
    }
  }

  // A window that has already begun can never be booked.
  const { startAt } = bookingInstants(date, startTime, endTime);
  if (startAt && startAt.getTime() <= Date.now()) {
    hard = "That time has already passed. Please pick a start time in the future.";
  }

  return { hard, pending };
}

/**
 * Query builders used by `useLiveQuery`. These return queries rather than
 * results so callers can subscribe instead of polling.
 */
export function bookingsQueriesForDates(
  facilityId: FacilityId,
  dates: string[],
): Query<DocumentData>[] {
  if (dates.length === 0) return [];

  return chunk(dates, IN_CHUNK).map((batch) =>
    query(
      collection(db, COLLECTIONS.availability),
      where("facilityId", "==", facilityId),
      where("date", "in", batch),
    ),
  );
}

export function blocksQueriesForDates(
  facilityId: FacilityId,
  dates: string[],
): Query<DocumentData>[] {
  if (dates.length === 0) return [];

  return chunk(dates, IN_CHUNK).map((batch) =>
    query(
      collection(db, COLLECTIONS.blockedSlots),
      where("facilityId", "==", facilityId),
      where("date", "in", batch),
    ),
  );
}

export function bookingsQueryForUser(uid: string): Query<DocumentData> {
  return query(
    collection(db, COLLECTIONS.bookings),
    where("userId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(100),
  );
}

export function allBookingsQuery(assignedFacilityIds?: FacilityId[]): Query<DocumentData> {
  return assignedFacilityIds?.length
    ? query(collection(db, COLLECTIONS.bookings), where("facilityId", "in", assignedFacilityIds.slice(0, 30)), orderBy("createdAt", "desc"), limit(300))
    : query(collection(db, COLLECTIONS.bookings), orderBy("createdAt", "desc"), limit(300));
}

export function reportBookingsQuery(start: string, end: string, assignedFacilityIds?: FacilityId[]): Query<DocumentData> {
  const base = collection(db, COLLECTIONS.bookings);
  return assignedFacilityIds?.length
    ? query(base, where("facilityId", "in", assignedFacilityIds.slice(0, 30)), where("date", ">=", start), where("date", "<=", end))
    : query(base, where("date", ">=", start), where("date", "<=", end));
}

export interface BookingAuditEntry {
  id: string;
  bookingId: string;
  facilityId: FacilityId;
  date: string;
  startTime: string;
  endTime: string;
  studentName: string;
  action: string;
  actorUid: string;
  actorName: string;
  previousStatus: string;
  status: string;
  createdAt: Timestamp | null;
}

export function bookingAuditQueries(assignedFacilityIds?: FacilityId[]): Query<DocumentData>[] {
  const audit = collection(db, COLLECTIONS.bookingAudit);
  if (!assignedFacilityIds?.length) return [query(audit, orderBy("createdAt", "desc"), limit(100))];
  return assignedFacilityIds.slice(0, 30).map((facilityId) =>
    query(audit, where("facilityId", "==", facilityId), orderBy("createdAt", "desc"), limit(100)),
  );
}

export function bookingRequestAlertQueries(assignedFacilityIds?: FacilityId[]): Query<DocumentData>[] {
  const alerts = collection(db, COLLECTIONS.requestAlerts);
  if (!assignedFacilityIds?.length) return [query(alerts, orderBy("createdAt", "desc"), limit(50))];
  return assignedFacilityIds.slice(0, 30).map((facilityId) =>
    query(alerts, where("facilityId", "==", facilityId), orderBy("createdAt", "desc"), limit(50)),
  );
}

export function parseBookingAuditDoc(snap: QueryDocumentSnapshot<DocumentData>): BookingAuditEntry {
  const data = snap.data();
  return {
    id: snap.id,
    bookingId: String(data.bookingId ?? ""),
    facilityId: String(data.facilityId ?? ""),
    date: String(data.date ?? ""),
    startTime: String(data.startTime ?? ""),
    endTime: String(data.endTime ?? ""),
    studentName: String(data.studentName ?? ""),
    action: String(data.action ?? "updated"),
    actorUid: String(data.actorUid ?? ""),
    actorName: String(data.actorName ?? "Admin"),
    previousStatus: String(data.previousStatus ?? ""),
    status: String(data.status ?? ""),
    createdAt: (data.createdAt as Timestamp | null) ?? null,
  };
}

export function notificationsQueryForUser(uid: string): Query<DocumentData> {
  return query(
    collection(db, COLLECTIONS.notifications),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50),
  );
}

export function blocksQueryForDate(facilityId: FacilityId, date: string): Query<DocumentData> {
  return query(
    collection(db, COLLECTIONS.blockedSlots),
    where("facilityId", "==", facilityId),
    where("date", "==", date),
  );
}

/** Parsers exported so live snapshots reuse the same mapping as one-shot reads. */
export const parseBookingDoc = (doc: { id: string; data: () => DocumentData }) =>
  parseBooking(doc.id, doc.data());

export const parseScheduleEntryDoc = (doc: { id: string; data: () => DocumentData }) =>
  toScheduleEntry(doc as QueryDocumentSnapshot<DocumentData>);

/** Parsers exported so live snapshots reuse the same mapping as one-shot reads. */
export const parseNotificationDoc = (doc: { id: string; data: () => DocumentData }) =>
  toNotification({ id: doc.id, data: () => doc.data() } as QueryDocumentSnapshot<DocumentData>);

export const parseBlockedSlotDoc = toBlockedSlot;

/** Folds live docs into the same per-block state the one-shot read produces. */
export const foldBlocksIntoSlots = foldIntoBlocks;

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
  equipment: Record<string, number>;
  purpose: string;
  attendees: number;
  notes: string;
  userId: string;
}

class ScheduleChangedError extends Error {
  constructor() {
    super("The schedule changed while checking this request.");
  }
}

export async function createBooking(input: NewBookingInput): Promise<string> {
  const { startTime, endTime, date, ...rest } = input;
  const calendar = await getSchoolCalendar();
  const closedReason = schoolDayReason(date, calendar);
  if (closedReason) throw new Error(closedReason);
  if (!input.idPhotoUrl) throw new Error("Upload your school ID photo before booking.");
  await updateDoc(doc(db, COLLECTIONS.idPhotos, input.idPhotoUrl), {
    facilityIds: arrayUnion(input.facilityId),
  });

  // Absolute instants alongside the wall-clock strings: the security rules can
  // compare these against `request.time`, which rules out a past booking even
  // if someone bypasses the form.
  const { startAt, endAt } = bookingInstants(date, startTime, endTime);

  const bookingRef = doc(collection(db, COLLECTIONS.bookings));
  const availabilityRef = doc(db, COLLECTIONS.availability, bookingRef.id);
  const alertRef = doc(db, COLLECTIONS.requestAlerts, bookingRef.id);
  const dayRef = doc(db, COLLECTIONS.scheduleDays, `${input.facilityId}__${date}`);
  const bookingData = {
    ...rest,
    date,
    startTime,
    endTime,
    startAt: startAt ? Timestamp.fromDate(startAt) : null,
    endAt: endAt ? Timestamp.fromDate(endAt) : null,
    status: "pending" satisfies BookingStatus,
    createdAt: serverTimestamp(),
  };

  // All reservations for one facility/day touch the same schedule-day
  // document. Firestore retries a transaction if another request changes it,
  // so simultaneous submissions cannot both pass the overlap check.
  let reservationSaved = false;
  for (let attempt = 0; attempt < 5 && !reservationSaved; attempt += 1) {
    const dayBeforeQueries = await getDoc(dayRef);
    const queriedRevision = dayBeforeQueries.exists()
      ? Number(dayBeforeQueries.data().revision ?? 0)
      : 0;
    const [availabilitySnap, blocksSnap] = await Promise.all([
      getDocs(query(
        collection(db, COLLECTIONS.availability),
        where("facilityId", "==", input.facilityId),
        where("date", "==", date),
      )),
      getDocs(query(
        collection(db, COLLECTIONS.blockedSlots),
        where("facilityId", "==", input.facilityId),
        where("date", "==", date),
      )),
    ]);

    try {
      await runTransaction(db, async (transaction) => {
        const daySnap = await transaction.get(dayRef);
        const currentRevision = daySnap.exists() ? Number(daySnap.data().revision ?? 0) : 0;
        if (currentRevision !== queriedRevision) throw new ScheduleChangedError();

        const requestedStart = toMinutes(startTime);
        const requestedEnd = toMinutes(endTime);
        if (requestedStart === null || requestedEnd === null || requestedEnd <= requestedStart) {
          throw new Error("That time is not valid. Please choose a valid start and end time.");
        }
        const requestedAvailabilityEnd = inclusiveHourEnd(requestedEnd);

        const closureConflict = blocksSnap.docs.some((blockDoc) => {
          const block = toBlockedSlot(blockDoc);
          const timeBlock = BLOCK_BY_ID[block.timeSlot];
          return Boolean(timeBlock && overlaps(requestedStart, requestedAvailabilityEnd, timeBlock.startMin, timeBlock.endMin));
        });
        if (closureConflict) throw new Error("That time overlaps a facility closure. Please choose another time.");

        const bookingConflict = availabilitySnap.docs.some((entryDoc) => {
          const entry = toScheduleEntry(entryDoc);
          if (entry.status !== "pending" && entry.status !== "approved") return false;
          const existingStart = toMinutes(entry.startTime);
          const existingEnd = toMinutes(entry.endTime);
          return existingStart !== null && existingEnd !== null && overlaps(requestedStart, requestedAvailabilityEnd, existingStart, inclusiveHourEnd(existingEnd));
        });
        if (bookingConflict) throw new Error("That time was just reserved or requested. Please choose another time.");

        const { startAt: startInstant } = bookingInstants(date, startTime, endTime);
        if (!startInstant || startInstant.getTime() <= Date.now()) {
          throw new Error("That time has already passed. Please choose a future time.");
        }

        transaction.set(dayRef, {
          facilityId: input.facilityId,
          date,
          revision: currentRevision + 1,
          lastBookingId: bookingRef.id,
          updatedAt: serverTimestamp(),
        });
        transaction.set(bookingRef, bookingData);
        transaction.set(alertRef, {
          bookingId: bookingRef.id,
          facilityId: input.facilityId,
          date,
          userId: input.userId,
          read: false,
          createdAt: serverTimestamp(),
        });
        transaction.set(availabilityRef, {
          facilityId: input.facilityId,
          date,
          startTime,
          endTime,
          status: "pending" satisfies BookingStatus,
        });
      });
      reservationSaved = true;
    } catch (error) {
      if (error instanceof ScheduleChangedError) continue;
      throw error;
    }
  }
  if (!reservationSaved) throw new Error("The schedule is updating. Please try your reservation again.");
  return bookingRef.id;
}

/** The student closes out their own booking, or an admin does it for them. */
export async function markBookingCompleted(
  bookingId: string,
  byAdmin = false,
  admin?: { uid: string; name: string },
): Promise<void> {
  await updateBookingState(bookingId, {
    status: "completed" satisfies BookingStatus,
    completedAt: serverTimestamp(),
    ...(byAdmin ? { reviewedAt: serverTimestamp(), reviewedBy: admin?.name ?? "Admin", reviewedByUid: admin?.uid ?? "" } : {}),
  }, { audit: byAdmin && admin ? { uid: admin.uid, name: admin.name, action: "completed" } : undefined });
}

/** Admin releases a slot because the student never arrived. */
export async function markBookingNoShow(bookingId: string, admin?: { uid: string; name: string }, issueWarning = false): Promise<void> {
  await updateBookingState(bookingId, {
    status: "no_show" satisfies BookingStatus,
    noShowAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
    ...(issueWarning ? { warningIssuedAt: serverTimestamp() } : {}),
    ...(admin ? { reviewedBy: admin.name, reviewedByUid: admin.uid } : {}),
  }, { audit: admin ? { uid: admin.uid, name: admin.name, action: issueWarning ? "no_show_warning" : "no_show" } : undefined });
}

/** Admin confirms that the approved facility booking has started. */
export async function markBookingInUse(bookingId: string, admin: { uid: string; name: string }): Promise<void> {
  const bookingSnap = await getDoc(doc(db, COLLECTIONS.bookings, bookingId));
  if (!bookingSnap.exists()) throw new Error("This reservation no longer exists.");
  const booking = parseBooking(bookingSnap.id, bookingSnap.data());
  if (booking.status !== "approved" || booking.inUseAt) throw new Error("This reservation is no longer available to mark in use.");
  await updateBookingState(bookingId, {
    status: "approved",
    inUseAt: serverTimestamp(),
    reviewedAt: serverTimestamp(),
    reviewedBy: admin.name,
    reviewedByUid: admin.uid,
  }, { audit: { uid: admin.uid, name: admin.name, action: "in_use" } });
}

export async function setBookingStatus(
  bookingId: string,
  status: Extract<BookingStatus, "approved" | "rejected">,
  admin: { uid: string; name: string },
  note = "",
): Promise<void> {
  await updateBookingState(bookingId, {
    status,
    reviewedAt: serverTimestamp(),
    reviewedBy: admin.name,
    reviewedByUid: admin.uid,
    adminNote: note.trim() || null,
  }, { checkSchedule: status === "approved", audit: { uid: admin.uid, name: admin.name, action: status } });
}

export async function cancelBooking(bookingId: string, admin?: { uid: string; name: string }): Promise<void> {
  // A student's cancellation may only touch `status` — the security rules
  // reject any other changed field, so `reviewedAt` is written by admins only.
  await updateBookingState(bookingId, admin
    ? { status: "cancelled" satisfies BookingStatus, reviewedAt: serverTimestamp(), reviewedBy: admin.name, reviewedByUid: admin.uid }
    : { status: "cancelled" satisfies BookingStatus }, {
      audit: admin ? { uid: admin.uid, name: admin.name, action: "cancelled" } : undefined,
    });
}

interface AdminAuditActor { uid: string; name: string; action: string; }

/** Keeps the private booking and its public schedule projection in one write. */
async function updateBookingState(
  bookingId: string,
  changes: Record<string, unknown> & { status: BookingStatus },
  options: { checkSchedule?: boolean; audit?: AdminAuditActor } = {},
): Promise<void> {
  const checkSchedule = options.checkSchedule ?? false;
  const bookingRef = doc(db, COLLECTIONS.bookings, bookingId);
  const availabilityRef = doc(db, COLLECTIONS.availability, bookingId);
  const auditRef = options.audit ? doc(collection(db, COLLECTIONS.bookingAudit)) : null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const bookingBefore = await getDoc(bookingRef);
    if (!bookingBefore.exists()) throw new Error("This reservation no longer exists.");
    const booking = parseBooking(bookingBefore.id, bookingBefore.data());
    const dayRef = doc(db, COLLECTIONS.scheduleDays, `${booking.facilityId}__${booking.date}`);
    const dayBefore = await getDoc(dayRef);
    const queriedRevision = dayBefore.exists() ? Number(dayBefore.data().revision ?? 0) : 0;

    if (checkSchedule) {
      if (booking.status !== "pending") throw new Error("This request has already been reviewed.");
      const [availabilitySnap, blocksSnap] = await Promise.all([
        getDocs(query(
          collection(db, COLLECTIONS.availability),
          where("facilityId", "==", booking.facilityId),
          where("date", "==", booking.date),
        )),
        getDocs(query(
          collection(db, COLLECTIONS.blockedSlots),
          where("facilityId", "==", booking.facilityId),
          where("date", "==", booking.date),
        )),
      ]);
      const start = toMinutes(booking.startTime);
      const end = toMinutes(booking.endTime);
      const blocked = start !== null && end !== null && blocksSnap.docs.some((blockDoc) => {
        const timeBlock = BLOCK_BY_ID[toBlockedSlot(blockDoc).timeSlot];
        return Boolean(timeBlock && overlaps(start, inclusiveHourEnd(end), timeBlock.startMin, timeBlock.endMin));
      });
      const conflict = start !== null && end !== null && availabilitySnap.docs.some((entryDoc) => {
        const entry = toScheduleEntry(entryDoc);
        if (entry.id === bookingId || (entry.status !== "pending" && entry.status !== "approved")) return false;
        const otherStart = toMinutes(entry.startTime);
        const otherEnd = toMinutes(entry.endTime);
        return otherStart !== null && otherEnd !== null && overlaps(start, inclusiveHourEnd(end), otherStart, inclusiveHourEnd(otherEnd));
      });
      if (blocked) throw new Error("This request overlaps a facility closure and cannot be approved.");
      if (conflict) throw new Error("Another pending or approved reservation overlaps this time. Resolve that request first.");
    }

    try {
      await runTransaction(db, async (transaction) => {
        const [bookingSnap, daySnap] = await Promise.all([
          transaction.get(bookingRef),
          transaction.get(dayRef),
        ]);
        if (!bookingSnap.exists()) throw new Error("This reservation no longer exists.");
        const revision = daySnap.exists() ? Number(daySnap.data().revision ?? 0) : 0;
        if (checkSchedule && revision !== queriedRevision) throw new ScheduleChangedError();

        transaction.update(bookingRef, changes);
        if (auditRef && options.audit) {
          transaction.set(auditRef, {
            bookingId,
            facilityId: booking.facilityId,
            date: booking.date,
            startTime: booking.startTime,
            endTime: booking.endTime,
            studentName: booking.fullName,
            action: options.audit.action,
            actorUid: options.audit.uid,
            actorName: options.audit.name,
            previousStatus: booking.status,
            status: changes.status,
            createdAt: serverTimestamp(),
          });
        }
        transaction.set(availabilityRef, {
          facilityId: booking.facilityId,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: changes.status,
        });
        transaction.set(dayRef, {
          facilityId: booking.facilityId,
          date: booking.date,
          revision: revision + 1,
          lastBookingId: bookingId,
          updatedAt: serverTimestamp(),
        });
      });
      return;
    } catch (error) {
      if (checkSchedule && error instanceof ScheduleChangedError) continue;
      throw error;
    }
  }
  throw new Error("The schedule is updating. Refresh and try again.");
}

/** One-time-compatible backfill for reservations created before projections existed. */
export async function ensureAvailabilityProjections(bookings: Booking[]): Promise<void> {
  const byDay = new Map<string, Booking[]>();
  for (const booking of bookings) {
    const key = `${booking.facilityId}__${booking.date}`;
    byDay.set(key, [...(byDay.get(key) ?? []), booking]);
  }

  await Promise.all([...byDay.entries()].map(async ([key, dayBookings]) => {
    const dayRef = doc(db, COLLECTIONS.scheduleDays, key);
    await runTransaction(db, async (transaction) => {
      const [daySnap, ...availabilitySnaps] = await Promise.all([
        transaction.get(dayRef),
        ...dayBookings.map((booking) =>
          transaction.get(doc(db, COLLECTIONS.availability, booking.id)),
        ),
      ]);
      const missing = dayBookings.filter((_, index) => !availabilitySnaps[index].exists());
      if (missing.length === 0) return;
      const revision = daySnap.exists() ? Number(daySnap.data().revision ?? 0) : 0;
      for (const booking of missing) {
        transaction.set(doc(db, COLLECTIONS.availability, booking.id), {
          facilityId: booking.facilityId,
          date: booking.date,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
        });
      }
      const lastBooking = missing[missing.length - 1];
      transaction.set(dayRef, {
        facilityId: lastBooking.facilityId,
        date: lastBooking.date,
        revision: revision + 1,
        lastBookingId: lastBooking.id,
        updatedAt: serverTimestamp(),
      });
    });
  }));
}

/** Backfills venue-scoped School ID access for records created before that privacy rule. */
export async function ensureIdPhotoFacilityAccess(bookings: Booking[]): Promise<void> {
  const facilitiesByPhoto = new Map<string, Set<string>>();
  for (const booking of bookings) {
    if (!booking.idPhotoUrl) continue;
    const facilities = facilitiesByPhoto.get(booking.idPhotoUrl) ?? new Set<string>();
    facilities.add(booking.facilityId);
    facilitiesByPhoto.set(booking.idPhotoUrl, facilities);
  }
  await Promise.all([...facilitiesByPhoto.entries()].map(async ([photoId, facilityIds]) => {
    const photoRef = doc(db, COLLECTIONS.idPhotos, photoId);
    if (!(await getDoc(photoRef)).exists()) return;
    await updateDoc(photoRef, { facilityIds: arrayUnion(...facilityIds) });
  }));
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

    return overlaps(startMin, inclusiveHourEnd(endMin), otherStart, inclusiveHourEnd(otherEnd));
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
  const dayRef = doc(db, COLLECTIONS.scheduleDays, `${facilityId}__${date}`);
  const timeBlock = BLOCK_BY_ID[timeSlot];
  if (!timeBlock) throw new Error("That closure period is not valid.");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const dayBefore = await getDoc(dayRef);
    const queriedRevision = dayBefore.exists() ? Number(dayBefore.data().revision ?? 0) : 0;
    const schedule = await getDocs(query(
      collection(db, COLLECTIONS.availability),
      where("facilityId", "==", facilityId),
      where("date", "==", date),
    ));
    const conflict = schedule.docs.some((entryDoc) => {
      const entry = toScheduleEntry(entryDoc);
      if (entry.status !== "pending" && entry.status !== "approved") return false;
      const start = toMinutes(entry.startTime);
      const end = toMinutes(entry.endTime);
      return start !== null && end !== null && overlaps(start, inclusiveHourEnd(end), timeBlock.startMin, timeBlock.endMin);
    });
    if (conflict) throw new Error("An active reservation uses part of this period. Resolve it before closing the facility.");

    try {
      await runTransaction(db, async (transaction) => {
        const daySnap = await transaction.get(dayRef);
        const revision = daySnap.exists() ? Number(daySnap.data().revision ?? 0) : 0;
        if (revision !== queriedRevision) throw new ScheduleChangedError();
        transaction.set(
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
        transaction.set(dayRef, {
          facilityId,
          date,
          revision: revision + 1,
          updatedAt: serverTimestamp(),
        });
      });
      return;
    } catch (error) {
      if (error instanceof ScheduleChangedError) continue;
      throw error;
    }
  }
  throw new Error("The schedule is updating. Try closing that period again.");
}

export async function unblockSlot(facilityId: FacilityId, date: string, timeSlot: string) {
  const dayRef = doc(db, COLLECTIONS.scheduleDays, `${facilityId}__${date}`);
  await runTransaction(db, async (transaction) => {
    const daySnap = await transaction.get(dayRef);
    const revision = daySnap.exists() ? Number(daySnap.data().revision ?? 0) : 0;
    transaction.delete(doc(db, COLLECTIONS.blockedSlots, blockedSlotId(facilityId, date, timeSlot)));
    transaction.set(dayRef, {
      facilityId,
      date,
      revision: revision + 1,
      updatedAt: serverTimestamp(),
    });
  });
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
export async function removeBooking(booking: Booking, admin?: { uid: string; name: string }): Promise<void> {
  if (await isRangeStillHeld(booking.facilityId, booking.date, booking.startTime, booking.endTime, booking.id)) {
    if (!admin) throw new Error("An administrator identity is required to remove this request.");
    await cancelBooking(booking.id, admin);
    return;
  }
  const bookingRef = doc(db, COLLECTIONS.bookings, booking.id);
  const availabilityRef = doc(db, COLLECTIONS.availability, booking.id);
  const dayRef = doc(db, COLLECTIONS.scheduleDays, `${booking.facilityId}__${booking.date}`);
  const auditRef = admin ? doc(collection(db, COLLECTIONS.bookingAudit)) : null;
  await runTransaction(db, async (transaction) => {
    const [bookingSnap, daySnap] = await Promise.all([
      transaction.get(bookingRef),
      transaction.get(dayRef),
    ]);
    if (!bookingSnap.exists()) return;
    const revision = daySnap.exists() ? Number(daySnap.data().revision ?? 0) : 0;
    transaction.delete(bookingRef);
    transaction.delete(availabilityRef);
    if (auditRef && admin) {
      transaction.set(auditRef, {
        bookingId: booking.id,
        facilityId: booking.facilityId,
        date: booking.date,
        startTime: booking.startTime,
        endTime: booking.endTime,
        studentName: booking.fullName,
        action: "deleted",
        actorUid: admin.uid,
        actorName: admin.name,
        previousStatus: booking.status,
        status: "deleted",
        createdAt: serverTimestamp(),
      });
    }
    transaction.set(dayRef, {
      facilityId: booking.facilityId,
      date: booking.date,
      revision: revision + 1,
      lastBookingId: booking.id,
      updatedAt: serverTimestamp(),
    });
  });
  // The ID is now stored on the student's profile and can be shared by later
  // reservations. Removing one booking must not delete that profile photo.
}

/* ── Notifications ─────────────────────────────────────────────────────── */

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
): Promise<boolean> {
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
    return true;
  } catch {
    return false;
  }
}

/* ── Mapping ───────────────────────────────────────────────────────────── */

function toScheduleEntry(snap: QueryDocumentSnapshot<DocumentData>): ScheduleEntry {
  const data = snap.data();
  return {
    id: snap.id,
    facilityId: data.facilityId as FacilityId,
    date: data.date as string,
    startTime: data.startTime as string,
    endTime: data.endTime as string,
    status: data.status as BookingStatus,
  };
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
    equipment: (data.equipment as Record<string, number>) ?? {},
    createdAt: data.createdAt ?? null,
    reviewedAt: data.reviewedAt ?? null,
    reviewedBy: (data.reviewedBy as string | null) ?? null,
    adminNote: (data.adminNote as string | null) ?? null,
    completedAt: (data.completedAt as Timestamp | null) ?? null,
    noShowAt: (data.noShowAt as Timestamp | null) ?? null,
    inUseAt: (data.inUseAt as Timestamp | null) ?? null,
    warningIssuedAt: (data.warningIssuedAt as Timestamp | null) ?? null,
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
