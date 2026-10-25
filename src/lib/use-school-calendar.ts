"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { DEFAULT_SCHOOL_CALENDAR, type SchoolCalendarSettings } from "@/lib/dates";

export function useSchoolCalendar() {
  const [calendar, setCalendar] = useState<SchoolCalendarSettings>(DEFAULT_SCHOOL_CALENDAR);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onSnapshot(doc(db, "schoolCalendar", "current"), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setCalendar({
          schoolYearLabel: String(data.schoolYearLabel ?? DEFAULT_SCHOOL_CALENDAR.schoolYearLabel),
          startDate: String(data.startDate ?? DEFAULT_SCHOOL_CALENDAR.startDate),
          endDate: String(data.endDate ?? DEFAULT_SCHOOL_CALENDAR.endDate),
          closedDates: Array.isArray(data.closedDates) ? data.closedDates.filter((date): date is string => typeof date === "string") : [],
          closedReasons: data.closedReasons && typeof data.closedReasons === "object" ? data.closedReasons as Record<string, string> : {},
        });
      } else {
        setCalendar(DEFAULT_SCHOOL_CALENDAR);
      }
      setLoaded(true);
      setError(null);
    }, () => {
      setError("Could not load the school calendar.");
      setLoaded(true);
    });
  }, []);

  return { calendar, loaded, error };
}
