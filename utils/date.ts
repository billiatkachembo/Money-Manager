export function formatDateDDMMYYYY(date: Date): string {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) {
    return '';
  }

  const day = String(safeDate.getDate()).padStart(2, '0');
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const year = safeDate.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatDateWithWeekday(date: Date): string {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) {
    return '';
  }

  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(safeDate);
  return `${weekday}, ${formatDateDDMMYYYY(safeDate)}`;
}

export function parseDateInput(value: string): Date | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dayFirstMatch = normalized.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dayFirstMatch) {
    const [, day, month, year] = dayFirstMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(normalized);
  if (Number.isNaN(fallback.getTime())) {
    return null;
  }

  return fallback;
}