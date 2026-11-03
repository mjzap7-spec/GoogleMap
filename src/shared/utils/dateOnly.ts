/** Local calendar dates must not use toISOString(), which can shift the day across time zones. */
export function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDateOnly(value: string, fallback: Date): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(fallback);
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : new Date(fallback);
}

export function clampDate(date: Date, minimum: Date, maximum: Date): Date {
  return new Date(Math.min(maximum.getTime(), Math.max(minimum.getTime(), date.getTime())));
}
