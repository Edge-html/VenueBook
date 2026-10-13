import type { Timestamp } from "firebase/firestore";

export type FacilityId = "gymnasium" | "avr";

export type BookingStatus = "pending" | "approved" | "rejected" | "cancelled";

export type Role = "student" | "admin";

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  role: Role;
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
  createdAt: Timestamp | null;
  reviewedAt?: Timestamp | null;
  reviewedBy?: string | null;
  adminNote?: string | null;
}

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