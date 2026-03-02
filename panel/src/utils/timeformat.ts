/** Format a decimal hour as "HH:MM" (24h). */
export function formatHour(hour: number): string {
  const h = Math.floor(((hour % 24) + 24) % 24);
  const m = Math.round((hour - Math.floor(hour)) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Format a relative offset as "SR+30m" or "SS-45m". */
export function formatRelativeOffset(offsetMinutes: number, anchor: 'sunset' | 'sunrise'): string {
  const sign = offsetMinutes >= 0 ? '+' : '';
  const abbr = anchor === 'sunset' ? 'SS' : 'SR';
  return `${abbr}${sign}${Math.round(offsetMinutes)}m`;
}

/** Format a decimal hour as short label, e.g. "6a", "12p", "9p", "12a". */
export function formatHourShort(hour: number): string {
  const h = Math.floor(((hour % 24) + 24) % 24);
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  if (h < 12) return `${h}a`;
  return `${h - 12}p`;
}
