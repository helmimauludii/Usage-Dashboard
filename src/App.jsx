import { AlertTriangle, CalendarClock, Database, FileText, Gauge } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CpCodeBars, CpCodeTable, MonthlyDetailTable, MonthlyUsageChart } from "./components/Charts";
import { KpiCard } from "./components/KpiCard";
import { defaultCustomer, sampleCpCodeRows, sampleSummaryRows } from "./data/sampleData";
import { formatGb, formatMonth, formatTb, numberFmt, percentClass } from "./lib/formatters";
import { calculateQuota } from "./lib/quota";
import "./styles.css";

function fallbackDashboardData() {
  return {
    customer: defaultCustomer,
    asOfDate: "2026-07-06",
    generatedAt: new Date().toISOString(),
    monthly: sampleSummaryRows,
    dailyUsage: [],
    cpCode: sampleCpCodeRows,
    sourceFiles: ["Bundled fallback sample data"],
    ingestionRuns: [
      {
        sourceFile: sampleSummaryRows[0].sourceFile,
        fileType: "summary",
        status: "fallback",
        rowCount: sampleSummaryRows.length,
        ingestedAt: new Date().toISOString(),
      },
    ],
  };
}

function latestAsOf(rows, dataAsOfDate) {
  if (dataAsOfDate) return dataAsOfDate;
  const latest = [...rows]
    .map((row) => row.reportGeneratedDate)
    .filter(Boolean)
    .sort()
    .at(-1);

  return latest || new Date().toISOString().slice(0, 10);
}

function latestDailyUsage(dailyRows) {
  return [...dailyRows]
    .filter((row) => row.statisticType === "Bytes" && row.uom === "GB")
    .sort((a, b) => a.usageDate.localeCompare(b.usageDate))
    .at(-1);
}

export default function App() {
  const [dashboardData, setDashboardData] = useState(fallbackDashboardData);
  const [loadStatus, setLoadStatus] = useState("loading");
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      try {
        const response = await fetch("/data/komdigi-usage.json", { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!cancelled) {
          setDashboardData({
            customer: data.customer || defaultCustomer,
            asOfDate: data.asOfDate,
            generatedAt: data.generatedAt,
            monthly: data.monthly || [],
            dailyUsage: data.dailyUsage || [],
            cpCode: data.cpCode || [],
            sourceFiles: data.sourceFiles || [],
            ingestionRuns: data.ingestionRuns || [],
          });
          setLoadStatus("ready");
        }
      } catch {
        if (!cancelled) setLoadStatus("fallback");
      }
    }

    loadDashboardData();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedSummaryRows = useMemo(
    () => [...dashboardData.monthly].sort((a, b) => a.reportMonth.localeCompare(b.reportMonth)),
    [dashboardData.monthly],
  );
  const sortedCpCodeRows = useMemo(() => [...dashboardData.cpCode].sort((a, b) => b.usageGb - a.usageGb), [dashboardData.cpCode]);
  const asOfDate = latestAsOf(sortedSummaryRows, dashboardData.asOfDate);
  const quota = useMemo(
    () => calculateQuota(dashboardData.customer, sortedSummaryRows, asOfDate),
    [dashboardData.customer, sortedSummaryRows, asOfDate],
  );
  const topCpCode = sortedCpCodeRows.at(0) || null;
  const latestDaily = latestDailyUsage(dashboardData.dailyUsage);
  const progressWidth = `${Math.min(100, Math.max(0, quota.quotaUtilizationPct))}%`;
  const remainingTone = quota.remainingQuotaGb < 0 ? "metric-danger" : "metric-good";
  const sourceDescription = dashboardData.sourceFiles.length > 0 ? dashboardData.sourceFiles.join(", ") : "No source file metadata";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">
            <Gauge size={16} />
            Komdigi Usage Visibility
          </div>
          <h1>Komdigi Akamai Usage Dashboard</h1>
          <p>
            {dashboardData.customer.productName} · Contract {dashboardData.customer.contractId} · Annual quota {formatTb(dashboardData.customer.annualQuotaTb)}
          </p>
        </div>
        <div className="asof-box readonly">
          <span>Last updated</span>
          <strong>{asOfDate}</strong>
          <small>{loadStatus === "ready" ? "Automated data file" : "Fallback data"}</small>
        </div>
      </header>

      <section className="tabs" aria-label="Dashboard views">
        <button className={activeTab === "overview" ? "active" : ""} onClick={() => setActiveTab("overview")}>
          <Gauge size={16} />
          Overview
        </button>
        <button className={activeTab === "cpCode" ? "active" : ""} onClick={() => setActiveTab("cpCode")}>
          <Database size={16} />
          CP Code
        </button>
        <button className={activeTab === "data" ? "active" : ""} onClick={() => setActiveTab("data")}>
          <FileText size={16} />
          Data Status
        </button>
      </section>

      <section className="layout production-layout">
        <div className="main-column">
          {activeTab === "overview" && (
            <>
              <section className="kpi-grid">
                <KpiCard label="YTD Usage" value={formatGb(quota.ytdUsageGb)} subtext="Calculated from monthly Summary data, including one-time YTD backfill and daily updates." />
                <KpiCard label="Annual Quota" value={formatTb(dashboardData.customer.annualQuotaTb)} subtext={`${numberFmt.format(quota.annualQuotaGb)} GB at ${dashboardData.customer.tbToGbFactor} GB per TB.`} />
                <KpiCard label="Quota Utilization" value={`${numberFmt.format(quota.quotaUtilizationPct)}%`} tone={percentClass(quota.quotaUtilizationPct)} subtext={`Remaining quota: ${formatGb(quota.remainingQuotaGb)}.`} />
                <KpiCard label="Current Month" value={quota.currentMonth ? formatGb(quota.currentMonth.usageGb) : "-"} subtext={quota.currentMonth ? `${formatMonth(quota.currentMonth.reportMonth)} · ${quota.currentMonth.dataStatus}` : "No summary rows available."} />
                <KpiCard label="Pro-rata YTD Quota" value={formatGb(quota.prorataQuotaGb)} tone={percentClass(quota.prorataUtilizationPct)} subtext={`Usage is ${numberFmt.format(quota.prorataUtilizationPct)}% of pro-rata quota.`} />
                <KpiCard label="Top CP Code" value={topCpCode ? topCpCode.cpCode : "-"} subtext={topCpCode ? `${topCpCode.cpName} · ${formatGb(topCpCode.usageGb)}` : "No CP Code data available."} />
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="label">Quota Progress</div>
                    <h2>Annual quota utilization</h2>
                  </div>
                  <strong className={remainingTone}>{formatGb(quota.remainingQuotaGb)} remaining</strong>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: progressWidth }} />
                </div>
                <div className="progress-meta">
                  <span>YTD usage {formatGb(quota.ytdUsageGb)}</span>
                  <span>Monthly entitlement {formatGb(quota.monthlyQuotaGb)}</span>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="label">Monthly Usage Trend</div>
                    <h2>Usage vs monthly average entitlement</h2>
                  </div>
                </div>
                <MonthlyUsageChart rows={sortedSummaryRows} monthlyQuotaGb={quota.monthlyQuotaGb} />
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="label">Monthly Detail</div>
                    <h2>Summary data</h2>
                  </div>
                </div>
                <MonthlyDetailTable rows={sortedSummaryRows} monthlyQuotaGb={quota.monthlyQuotaGb} />
              </section>
            </>
          )}

          {activeTab === "cpCode" && (
            <>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="label">Top CP Code</div>
                    <h2>Current month usage distribution</h2>
                  </div>
                </div>
                <CpCodeBars rows={sortedCpCodeRows} />
              </section>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <div className="label">CP Code Detail</div>
                    <h2>Breakdown by usage</h2>
                  </div>
                </div>
                <CpCodeTable rows={sortedCpCodeRows} />
              </section>
            </>
          )}

          {activeTab === "data" && (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <div className="label">Data Pipeline Status</div>
                  <h2>Backfill plus daily report merge</h2>
                </div>
              </div>
              <div className="status-grid">
                <div>
                  <strong>{sortedSummaryRows.length}</strong>
                  <span>Monthly summary rows</span>
                </div>
                <div>
                  <strong>{dashboardData.dailyUsage.length}</strong>
                  <span>Daily cumulative rows</span>
                </div>
                <div>
                  <strong>{sortedCpCodeRows.length}</strong>
                  <span>CP Code rows</span>
                </div>
              </div>
              <div className="logic-note">
                <AlertTriangle size={18} />
                <p>
                  YTD usage is calculated from monthly Summary rows. Daily usage rows are cumulative snapshots and are kept for current-month visibility only, not summed into YTD.
                </p>
              </div>
              <div className="pipeline-card">
                <CalendarClock size={18} />
                <div>
                  <strong>Latest daily usage snapshot</strong>
                  <span>{latestDaily ? `${latestDaily.usageDate} · ${formatGb(latestDaily.value)}` : "No daily usage snapshot available."}</span>
                </div>
              </div>
              <div className="source-list">
                <div className="label">Source files</div>
                <p>{sourceDescription}</p>
              </div>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
