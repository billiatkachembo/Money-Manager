const APP_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function normalizeDate(value: Date | string | number): Date | null {
  const safeDate = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(safeDate.getTime())) {
    return null;
  }

  return safeDate;
}

function buildValidatedDate(
  year: number,
  monthIndex: number,
  day: number,
  hours = 0,
  minutes = 0,
  seconds = 0
): Date | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(monthIndex) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  const parsed = new Date(year, monthIndex, day, hours, minutes, seconds, 0);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== monthIndex ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hours ||
    parsed.getMinutes() !== minutes ||
    parsed.getSeconds() !== seconds
  ) {
    return null;
  }

  return parsed;
}

function parseDateTimeParts(match: RegExpMatchArray, yearIndex: number, monthIndex: number, dayIndex: number): Date | null {
  const year = Number(match[yearIndex]);
  const month = Number(match[monthIndex]);
  const day = Number(match[dayIndex]);
  const hours = match[4] ? Number(match[4]) : 0;
  const minutes = match[5] ? Number(match[5]) : 0;
  const seconds = match[6] ? Number(match[6]) : 0;
  return buildValidatedDate(year, month - 1, day, hours, minutes, seconds);
}

export function formatDateDDMMYYYY(date: Date | string | number): string {
  const safeDate = normalizeDate(date);
  if (!safeDate) {
    return '';
  }

  const day = String(safeDate.getDate()).padStart(2, '0');
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const year = safeDate.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatDateWithWeekday(date: Date | string | number): string {
  const safeDate = normalizeDate(date);
  if (!safeDate) {
    return '';
  }

  const weekday = APP_WEEKDAY_LABELS[safeDate.getDay()];
  return `${formatDateDDMMYYYY(safeDate)} (${weekday})`;
}

export function formatDateTimeWithWeekday(date: Date | string | number): string {
  const safeDate = normalizeDate(date);
  if (!safeDate) {
    return '';
  }

  const hours = String(safeDate.getHours()).padStart(2, '0');
  const minutes = String(safeDate.getMinutes()).padStart(2, '0');
  return `${formatDateWithWeekday(safeDate)} ${hours}:${minutes}`;
}

export function parseDateInput(value: string): Date | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const withoutWeekday = normalized
    .replace(/\s*\((sun|mon|tue|wed|thu|fri|sat|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const isoDateMatch = withoutWeekday.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (isoDateMatch) {
    return parseDateTimeParts(isoDateMatch, 1, 2, 3);
  }

  const dayFirstMatch = withoutWeekday.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dayFirstMatch) {
    return parseDateTimeParts(dayFirstMatch, 3, 2, 1);
  }

  const fallback = normalizeDate(withoutWeekday);
  if (!fallback) {
    return null;
  }

  return fallback;
}

export function parseDateValue(value: Date | string | number | null | undefined): Date | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }

  if (value instanceof Date) {
    const parsed = normalizeDate(value);
    return parsed ?? undefined;
  }

  if (typeof value === 'string') {
    return parseDateInput(value) ?? undefined;
  }

  return normalizeDate(value) ?? undefined;
}