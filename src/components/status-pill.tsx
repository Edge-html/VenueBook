import type { BookingStatus, SlotState } from "@/lib/types";

const STATUS_STYLES: Record<BookingStatus, string> = {
  pending: "bg-pending-soft text-pending",
  approved: "bg-available-soft text-available",
  completed: "bg-ink-200 text-ink-600",
  no_show: "bg-booked-soft text-booked",
  rejected: "bg-booked-soft text-booked",
  cancelled: "bg-ink-200 text-ink-600",
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  completed: "Completed",
  no_show: "No show",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function StatusPill({
  status,
  size = "md",
}: {
  status: BookingStatus;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${STATUS_STYLES[status]} ${
        size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs"
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

const SLOT_STYLES: Record<SlotState, string> = {
  available: "bg-available-soft text-available",
  booked: "bg-booked-soft text-booked",
  pending: "bg-pending-soft text-pending",
  blocked: "bg-closed-soft text-closed",
};

const SLOT_LABELS: Record<SlotState, string> = {
  available: "Available",
  booked: "Booked",
  pending: "Pending",
  blocked: "Closed",
};

export function SlotChip({
  state,
  label,
  className = "",
  title,
}: {
  state: SlotState;
  label: string;
  className?: string;
  /** Overrides the state tooltip, e.g. with the hour's full range. */
  title?: string;
}) {
  return (
    <span
      title={title ?? SLOT_LABELS[state]}
      className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-xs font-semibold ${SLOT_STYLES[state]} ${className}`}
    >
      {label}
    </span>
  );
}

export const LEGEND: Array<{ label: string; className: string }> = [
  { label: "Available", className: "bg-available" },
  { label: "Booked", className: "bg-booked" },
  { label: "Pending", className: "bg-pending" },
];

export const FULL_LEGEND: typeof LEGEND = [
  ...LEGEND,
  { label: "Closed", className: "bg-closed" },
];