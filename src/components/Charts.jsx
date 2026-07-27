import { formatGb, formatMonth, integerFmt, numberFmt, percentClass } from "../lib/formatters";

export function MonthlyUsageChart({ rows, monthlyQuotaGb }) {
  const maxUsage = Math.max(monthlyQuotaGb, ...rows.map((row) => row.usageGb), 1);

  return (
    <div className="chart" role="img" aria-label="Monthly usage trend chart">
      {rows.map((row) => {
        const height = Math.max(3, (row.usageGb / maxUsage) * 100);
        const quotaLine = Math.min(100, (monthlyQuotaGb / maxUsage) * 100);

        return (
          <div className="chart-column" key={row.reportMonth}>
            <div className="chart-value">{numberFmt.format(row.usageGb)}</div>
            <div className="chart-bar-track">
              <div className="quota-marker" style={{ bottom: `${quotaLine}%` }} />
              <div className="chart-bar" style={{ height: `${height}%` }} />
            </div>
            <div className="chart-label">{formatMonth(row.reportMonth).split(" ")[0]}</div>
          </div>
        );
      })}
    </div>
  );
}

export function CpCodeBars({ rows }) {
  const topRows = [...rows].sort((a, b) => b.usageGb - a.usageGb).slice(0, 10);
  const maxUsage = Math.max(...topRows.map((row) => row.usageGb), 1);

  if (topRows.length === 0) {
    return <div className="empty-state">No CP Code data imported yet.</div>;
  }

  return (
    <div className="ranked-bars">
      {topRows.map((row) => (
        <div className="ranked-row" key={`${row.cpCode}-${row.cpName}`}>
          <div className="ranked-label">
            <strong>{row.cpCode}</strong>
            <span>{row.cpName}</span>
          </div>
          <div className="ranked-track">
            <div className="ranked-fill" style={{ width: `${(row.usageGb / maxUsage) * 100}%` }} />
          </div>
          <div className="ranked-value">{formatGb(row.usageGb)}</div>
        </div>
      ))}
    </div>
  );
}

export function MonthlyDetailTable({ rows, monthlyQuotaGb }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Usage GB</th>
            <th>Monthly Quota GB</th>
            <th>Usage vs Quota</th>
            <th>Hits</th>
            <th>95/5 Mbps</th>
            <th>Peak Mbps</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const pct = monthlyQuotaGb > 0 ? (row.usageGb / monthlyQuotaGb) * 100 : 0;
            return (
              <tr key={row.reportMonth}>
                <td data-label="Month">{formatMonth(row.reportMonth)}</td>
                <td data-label="Usage GB">{numberFmt.format(row.usageGb)}</td>
                <td data-label="Monthly Quota GB">{numberFmt.format(monthlyQuotaGb)}</td>
                <td data-label="Usage vs Quota" className={percentClass(pct)}>{numberFmt.format(pct)}%</td>
                <td data-label="Hits">{integerFmt.format(row.hits || 0)}</td>
                <td data-label="95/5 Mbps">{numberFmt.format(row.p95Mbps || 0)}</td>
                <td data-label="Peak Mbps">{numberFmt.format(row.peakMbps || 0)}</td>
                <td data-label="Status">
                  <span className="status-pill">{row.dataStatus || "Imported"}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function CpCodeTable({ rows }) {
  const totalUsage = rows.reduce((sum, row) => sum + row.usageGb, 0);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>CP Code</th>
            <th>Name / Domain</th>
            <th>Month</th>
            <th>Usage GB</th>
            <th>Hits</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {[...rows]
            .sort((a, b) => b.usageGb - a.usageGb)
            .map((row) => {
              const share = totalUsage > 0 ? (row.usageGb / totalUsage) * 100 : 0;
              return (
                <tr key={`${row.reportMonth}-${row.cpCode}-${row.cpName}`}>
                  <td data-label="CP Code">{row.cpCode}</td>
                  <td data-label="Name / Domain">{row.cpName}</td>
                  <td data-label="Month">{formatMonth(row.reportMonth)}</td>
                  <td data-label="Usage GB">{numberFmt.format(row.usageGb)}</td>
                  <td data-label="Hits">{integerFmt.format(row.hits || 0)}</td>
                  <td data-label="Share">{numberFmt.format(share)}%</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
