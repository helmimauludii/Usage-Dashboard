export const numberFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export const integerFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatGb(value) {
  return `${numberFmt.format(value || 0)} GB`;
}

export function formatTb(value) {
  return `${numberFmt.format(value || 0)} TB`;
}

export function formatMonth(period) {
  if (!period) return "-";
  return new Date(`${period}-01T00:00:00`).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function percentClass(value) {
  if (value > 100) return "metric-danger";
  if (value > 80) return "metric-warn";
  return "metric-good";
}
