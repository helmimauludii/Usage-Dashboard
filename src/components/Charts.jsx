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
  const totalUsage = topRows.reduce((sum, row) => sum + Number(row.usageGb || 0), 0);

  if (topRows.length === 0) {
    return <div className="empty-state">No CP Code data imported yet.</div>;
  }

  return (
    <div className="ranked-bars">
      {topRows.map((row, index) => {
        const share = totalUsage > 0 ? (row.usageGb / totalUsage) * 100 : 0;
        return (
        <div className="ranked-row" key={`${row.cpCode}-${row.cpName}`}>
          <div className="ranked-label">
            <span className="rank-number">{index + 1}</span>
            <div>
              <strong>{row.cpName}</strong>
              <span>{row.cpCode}</span>
            </div>
          </div>
          <div className="ranked-track">
            <div className="ranked-fill" style={{ width: `${(row.usageGb / maxUsage) * 100}%` }} />
          </div>
          <div className="ranked-value">
            <strong>{formatGb(row.usageGb)}</strong>
            <span>{numberFmt.format(share)}% of top 10</span>
          </div>
        </div>
        );
      })}
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
                <td>{formatMonth(row.reportMonth)}</td>
                <td>{numberFmt.format(row.usageGb)}</td>
                <td>{numberFmt.format(monthlyQuotaGb)}</td>
                <td className={percentClass(pct)}>{numberFmt.format(pct)}%</td>
                <td>{integerFmt.format(row.hits || 0)}</td>
                <td>{numberFmt.format(row.p95Mbps || 0)}</td>
                <td>{numberFmt.format(row.peakMbps || 0)}</td>
                <td>
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
                  <td>{row.cpCode}</td>
                  <td>{row.cpName}</td>
                  <td>{formatMonth(row.reportMonth)}</td>
                  <td>{numberFmt.format(row.usageGb)}</td>
                  <td>{integerFmt.format(row.hits || 0)}</td>
                  <td>{numberFmt.format(share)}%</td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
