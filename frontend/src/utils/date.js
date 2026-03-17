function ordinalSuffix(day) {
  const d = Number(day);
  if (Number.isNaN(d)) return "";
  const mod100 = d % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  switch (d % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

export function formatDateParts(date) {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const day = d.getDate();
  const suffix = ordinalSuffix(day);
  const month = d.toLocaleString(undefined, { month: "short" });
  return { day, suffix, month };
}

// Fallback plain-text date label (no year). Use PrettyDate component for superscript.
export function formatDateLabel(date) {
  const parts = formatDateParts(date);
  if (!parts) return "";
  return `${parts.day}${parts.suffix} ${parts.month}`;
}

export function toIsoDate(date) {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISO(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr);
}

export function formatRelativeDays(days) {
  if (days === null || days === undefined) return "—";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0) return `in ${days} days`;
  return `${Math.abs(days)} days ago`;
}
