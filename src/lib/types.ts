import type { Timestamp } from "firebase/firestore";

export type FacilityId = string;

/**
 * `completed` — the student finished using the venue and closed it out.
 * `no_show`   — an admin released the slot because nobody arrived.
 * Both free the slot for someone else.
 */
export type BookingStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "completed"
  | "no_show";

/** Statuses that still hold the slot. */
export const ACTIVE_STATUSES: BookingStatus[] = ["pending", "approved"];

export type Role = "student" | "admin";

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  grade?: string;
  section?: string;
  idPhotoUrl?: string | null;
  verificationRequired?: boolean;
  emailOtpVerified?: boolean;
  assignedFacilityIds?: FacilityId[];
  createdAt?: Timestamp;
}

export interface Booking {
  id: string;
  facilityId: FacilityId;
  /** Calendar day in `YYYY-MM-DD` form, always local to the school. */
  date: string;
  /** Start time in 24-hour "HH:mm". Bookings are free-form, not block-sized. */
  startTime: string;
  /** End time in 24-hour "HH:mm". Always after `startTime`. */
  endTime: string;
  /**
   * The same window as absolute instants. Kept alongside the strings so the
   * security rules can reject a booking that starts in the past with a simple
   * comparison against `request.time`.
   */
  startAt: Timestamp | null;
  endAt: Timestamp | null;
  /** Legacy block id, only present on bookings created before free-form times. */
  timeSlot?: string;
  status: BookingStatus;
  userId: string;
  fullName: string;
  grade: string;
  section: string;
  /** Id of the uploaded school ID in `idPhotos`, if one was attached. */
  idPhotoUrl: string | null;
  purpose: string;
  attendees: number;
  notes: string;
  equipment?: Record<string, number>;
  createdAt: Timestamp | null;
  reviewedAt?: Timestamp | null;
  reviewedBy?: string | null;
  adminNote?: string | null;
  /** When the venue was closed out, by the student or an admin. */
  completedAt?: Timestamp | null;
  /** When an admin released the slot because nobody arrived. */
  noShowAt?: Timestamp | null;
}

/**
 * Everything the UI needs to describe where a booking stands right now,
 * derived from the status and the clock rather than stored.
 */
export type BookingPhase =
  | "upcoming"
  | "pending"
  | "in_use"
  | "over"
  | "completed"
  | "no_show"
  | "cancelled"
  | "rejected";

/** A slot the admin has taken offline (maintenance, school event, …). */
export interface BlockedSlot {
  id: string;
  facilityId: FacilityId;
  date: string;
  timeSlot: string;
  reason: string;
  createdAt: Timestamp | null;
  createdBy: string | null;
}

/**
 * What a single calendar cell looks like to the user.
 * `booked` beats `pending` beats `blocked` beats `available` when several
 * records touch the same slot.
 */
export type SlotState = "available" | "booked" | "pending" | "blocked";

export interface AppNotification {
  id: string;
  uid: string;
  title: string;
  body: string;
  kind: "approved" | "rejected" | "cancelled" | "system";
  bookingId: string | null;
  read: boolean;
  createdAt: Timestamp | null;
}
