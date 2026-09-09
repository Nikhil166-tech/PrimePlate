import React, { useState, useMemo, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { DayPicker } from '@daypicker/react';
import '@daypicker/react/dist/style.css';
import './MealCalendar.css';

export type MealUsageStatus = 'checked-in' | 'missed' | 'upcoming' | 'outside-subscription' | string;

export interface MealCalendarProps {
  /**
   * Map of ISO date strings "YYYY-MM-DD" to status.
   * e.g. { "2026-09-04": "missed", "2026-09-09": "checked-in" }
   */
  usageByDate?: Record<string, MealUsageStatus>;
  /** Start date of subscription cycle in "YYYY-MM-DD" */
  startDate?: string;
  /** End date of subscription cycle in "YYYY-MM-DD" */
  endDate?: string;
  /** Optional metadata per date (e.g. check-in timestamp) */
  detailsByDate?: Record<string, { time?: string | null; source?: string | null }>;
  /** Optional title for the calendar card */
  title?: string;
  /** Optional subtitle for the calendar card */
  subtitle?: string;
  /** Optional callback when a date is selected */
  onDateClick?: (dateStr: string, status: MealUsageStatus) => void;
}

/**
 * Formats a Date object to "YYYY-MM-DD" in local time.
 */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Reusable PrimePlate Meal Calendar Component.
 * Visualizes subscriber meal usage through color-coded calendar dates
 * using @daypicker/react.
 */
export const MealCalendar: React.FC<MealCalendarProps> = ({
  usageByDate = {},
  startDate,
  endDate,
  detailsByDate = {},
  title = 'Meal History',
  subtitle = 'Track your daily meal usage',
  onDateClick,
}) => {
  const todayKey = useMemo(() => toDateKey(new Date()), []);

  // Determine starting month for the calendar
  const initialMonth = useMemo(() => {
    // If today is within or near subscription, default to current month
    if (startDate) {
      const parts = startDate.split('-').map(Number);
      if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, 1);
      }
    }
    return new Date();
  }, [startDate]);

  const [month, setMonth] = useState<Date>(initialMonth);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // Sync month state when initialMonth / startDate updates
  useEffect(() => {
    setMonth(initialMonth);
  }, [initialMonth]);

  // Helper matchers
  const isOutsideSub = (date: Date): boolean => {
    const key = toDateKey(date);
    if (startDate && key < startDate) return true;
    if (endDate && key > endDate) return true;
    return false;
  };

  const isCheckedIn = (date: Date): boolean => {
    if (isOutsideSub(date)) return false;
    const key = toDateKey(date);
    const val = (usageByDate[key] || '').toLowerCase();
    return val === 'checked-in' || val === 'used';
  };

  const isMissed = (date: Date): boolean => {
    if (isOutsideSub(date)) return false;
    const key = toDateKey(date);
    if (isCheckedIn(date)) return false;
    const val = (usageByDate[key] || '').toLowerCase();
    if (val === 'missed' || val === 'not_checked_in') return true;
    // In the past and within subscription, but no check-in recorded
    return key < todayKey;
  };

  const isTodayDate = (date: Date): boolean => {
    return toDateKey(date) === todayKey;
  };

  const isUpcoming = (date: Date): boolean => {
    if (isOutsideSub(date)) return false;
    const key = toDateKey(date);
    return key > todayKey && !isCheckedIn(date);
  };

  const getStatus = (key: string): MealUsageStatus => {
    if ((startDate && key < startDate) || (endDate && key > endDate)) {
      return 'outside-subscription';
    }
    const val = (usageByDate[key] || '').toLowerCase();
    if (val === 'checked-in' || val === 'used') return 'checked-in';
    if (val === 'missed' || val === 'not_checked_in' || key < todayKey) return 'missed';
    return 'upcoming';
  };

  const handleDayClick = (date: Date) => {
    const key = toDateKey(date);
    if (isOutsideSub(date)) return;

    setSelectedDateKey((prev) => (prev === key ? null : key));

    if (onDateClick) {
      onDateClick(key, getStatus(key));
    }
  };

  // Selected date info for the lightweight tooltip
  const selectedInfo = useMemo(() => {
    if (!selectedDateKey) return null;
    const status = getStatus(selectedDateKey);
    const details = detailsByDate[selectedDateKey];

    // Format human-readable date e.g. "Sep 09"
    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const dateObj = new Date(y, (m || 1) - 1, d || 1);
    const formattedDate = dateObj.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
    });

    return {
      dateKey: selectedDateKey,
      formattedDate,
      status,
      time: details?.time || null,
      source: details?.source || null,
    };
  }, [selectedDateKey, usageByDate, detailsByDate, startDate, endDate, todayKey]);

  return (
    <div className="meal-calendar-card">
      <div className="meal-calendar-header">
        <h3 className="meal-calendar-title">{title}</h3>
        <p className="meal-calendar-subtitle">{subtitle}</p>
      </div>

      <DayPicker
        mode="single"
        navLayout="around"
        month={month}
        onMonthChange={(newMonth) => {
          setMonth(newMonth);
        }}
        onPrevClick={(prevMonth) => {
          setMonth(prevMonth);
        }}
        onNextClick={(nextMonth) => {
          setMonth(nextMonth);
        }}
        onDayClick={handleDayClick}
        modifiers={{
          checkedIn: (d) => isCheckedIn(d),
          missed: (d) => isMissed(d),
          today: (d) => isTodayDate(d),
          outsideSub: (d) => isOutsideSub(d),
          upcoming: (d) => isUpcoming(d),
        }}
        modifiersClassNames={{
          checkedIn: 'meal-day-checked-in',
          missed: 'meal-day-missed',
          today: 'meal-day-today',
          outsideSub: 'meal-day-outside-sub',
          upcoming: 'meal-day-upcoming',
        }}
        disabled={(d) => isOutsideSub(d)}
        showOutsideDays={false}
      />

      {/* Lightweight interactive chip/tooltip when a date is clicked */}
      {selectedInfo && (
        <div className="meal-calendar-tooltip" role="status">
          <span className="meal-calendar-tooltip-date">{selectedInfo.formattedDate}:</span>
          <span className={`meal-calendar-tooltip-status ${selectedInfo.status}`}>
            {selectedInfo.status === 'checked-in' && 'Checked In'}
            {selectedInfo.status === 'missed' && 'Missed'}
            {selectedInfo.status === 'upcoming' && 'Upcoming'}
            {selectedInfo.status === 'outside-subscription' && 'Outside Plan'}
          </span>
          {selectedInfo.time && (
            <span className="meal-calendar-tooltip-time">({selectedInfo.time})</span>
          )}
        </div>
      )}

      {/* Minimal Legend */}
      <div className="meal-calendar-legend">
        <span className="meal-legend-item">
          <span className="meal-legend-dot checked-in" />
          Checked in
        </span>
        <span className="meal-legend-item">
          <span className="meal-legend-dot missed" />
          Missed
        </span>
        <span className="meal-legend-item">
          <span className="meal-legend-dot today" />
          Today
        </span>
      </div>
    </div>
  );
};

/**
 * Mounting helper for vanilla TypeScript / HTML applications.
 * Mounts the React MealCalendar into any DOM element and returns an unmount function.
 */
export function mountMealCalendar(container: HTMLElement, props: MealCalendarProps): () => void {
  const root = createRoot(container);
  root.render(<MealCalendar {...props} />);
  return () => {
    root.unmount();
  };
}

export default MealCalendar;
