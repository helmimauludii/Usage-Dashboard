function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function monthsElapsed(startPeriod, asOfDate) {
  const start = new Date(`${startPeriod}-01T00:00:00`);
  const asOf = new Date(`${asOfDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(asOf.getTime())) {
    return 0;
  }

  const fullMonthsBeforeCurrent =
    (asOf.getFullYear() - start.getFullYear()) * 12 + (asOf.getMonth() - start.getMonth());
  const fraction = asOf.getDate() / daysInMonth(asOf);
  return Math.max(0, fullMonthsBeforeCurrent + fraction);
}

export function calculateQuota(customer, summaryRows, asOfDate) {
  const sortedRows = [...summaryRows].sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));
  const annualQuotaGb = Number(customer.annualQuotaTb || 0) * Number(customer.tbToGbFactor || 1000);
  const monthlyQuotaGb = annualQuotaGb / 12;
  const ytdUsageGb = sortedRows.reduce((sum, row) => sum + Number(row.usageGb || 0), 0);
  const elapsed = monthsElapsed(customer.contractStartMonth, asOfDate);
  const prorataQuotaGb = monthlyQuotaGb * elapsed;
  const remainingQuotaGb = annualQuotaGb - ytdUsageGb;
  const quotaUtilizationPct = annualQuotaGb > 0 ? (ytdUsageGb / annualQuotaGb) * 100 : 0;
  const prorataUtilizationPct = prorataQuotaGb > 0 ? (ytdUsageGb / prorataQuotaGb) * 100 : 0;

  return {
    annualQuotaGb,
    monthlyQuotaGb,
    ytdUsageGb,
    remainingQuotaGb,
    quotaUtilizationPct,
    prorataQuotaGb,
    prorataUtilizationPct,
    currentMonth: sortedRows.at(-1) || null,
  };
}
