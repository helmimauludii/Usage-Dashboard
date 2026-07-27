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

function dailyReportTotalGb(dailyRows) {
  return dailyRows
    .filter((row) => row.statisticType === "Bytes" && row.uom === "GB")
    .reduce((sum, row) => sum + Number(row.value || 0), 0);
}

function monthWindow(asOfDate) {
  const date = new Date(`${asOfDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { dayOfMonth: 1, daysInMonth: 30, daysRemaining: 29 };
  }

  const dayOfMonth = date.getDate();
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return {
    dayOfMonth,
    daysInMonth,
    daysRemaining: Math.max(0, daysInMonth - dayOfMonth),
  };
}

function monthlyControlSignal(currentUsageGb, monthlyQuotaGb, asOfDate) {
  const { dayOfMonth, daysInMonth, daysRemaining } = monthWindow(asOfDate);
  const expectedUsageGb = (monthlyQuotaGb / daysInMonth) * dayOfMonth;
  const projectedUsageGb = dayOfMonth > 0 ? (currentUsageGb / dayOfMonth) * daysInMonth : currentUsageGb;
  const dailyAverageGb = dayOfMonth > 0 ? currentUsageGb / dayOfMonth : 0;
  const remainingMonthlyGb = monthlyQuotaGb - currentUsageGb;
  const usageVsMonthlyPct = monthlyQuotaGb > 0 ? (currentUsageGb / monthlyQuotaGb) * 100 : 0;
  const projectedVsMonthlyPct = monthlyQuotaGb > 0 ? (projectedUsageGb / monthlyQuotaGb) * 100 : 0;
  const pacePct = expectedUsageGb > 0 ? (currentUsageGb / expectedUsageGb) * 100 : 0;
  const dailyAllowanceGb = daysRemaining > 0 ? Math.max(0, remainingMonthlyGb) / daysRemaining : 0;

  if (projectedVsMonthlyPct >= 100 || remainingMonthlyGb < 0) {
    return {
      dayOfMonth,
      daysInMonth,
      daysRemaining,
      expectedUsageGb,
      projectedUsageGb,
      dailyAverageGb,
      remainingMonthlyGb,
      usageVsMonthlyPct,
      projectedVsMonthlyPct,
      pacePct,
      dailyAllowanceGb,
      tone: "danger",
      status: "Follow-up needed this month",
      guidance: "The month-end projection is above the average monthly entitlement. Review traffic drivers or policy adjustments before month-end.",
    };
  }

  if (projectedVsMonthlyPct >= 85 || pacePct >= 110) {
    return {
      dayOfMonth,
      daysInMonth,
      daysRemaining,
      expectedUsageGb,
      projectedUsageGb,
      dailyAverageGb,
      remainingMonthlyGb,
      usageVsMonthlyPct,
      projectedVsMonthlyPct,
      pacePct,
      dailyAllowanceGb,
      tone: "warn",
      status: "Monitor closely",
      guidance: "Current-month usage is running faster than the ideal pace. Review the largest CP Codes and recent traffic changes.",
    };
  }

  return {
    dayOfMonth,
    daysInMonth,
    daysRemaining,
    expectedUsageGb,
    projectedUsageGb,
    dailyAverageGb,
    remainingMonthlyGb,
    usageVsMonthlyPct,
    projectedVsMonthlyPct,
    pacePct,
    dailyAllowanceGb,
    tone: "good",
    status: "On a controlled pace",
    guidance: "Current-month usage is tracking within a controlled range against the average monthly entitlement.",
  };
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
  const dailyTotalGb = dailyReportTotalGb(dashboardData.dailyUsage);
  const progressWidth = `${Math.min(100, Math.max(0, quota.quotaUtilizationPct))}%`;
  const remainingTone = quota.remainingQuotaGb < 0 ? "metric-danger" : "metric-good";
  const sourceDescription = dashboardData.sourceFiles.length > 0 ? dashboardData.sourceFiles.join(", ") : "No source file metadata";
  const currentMonthUsageGb = quota.currentMonth?.usageGb || 0;
  const monthlySignal = monthlyControlSignal(currentMonthUsageGb, quota.monthlyQuotaGb, asOfDate);
  const monthlyProgressWidth = `${Math.min(100, Math.max(0, monthlySignal.usageVsMonthlyPct))}%`;
  const projectedProgressWidth = `${Math.min(100, Math.max(0, monthlySignal.projectedVsMonthlyPct))}%`;
  const monthlyToneClass = `metric-${monthlySignal.tone}`;

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
              <section className={`monthly-hero monthly-${monthlySignal.tone}`}>
                <div className="monthly-primary">
                  <div className="label">Current Month Control</div>
                  <h2>{quota.currentMonth ? formatMonth(quota.currentMonth.reportMonth) : "Current month"}</h2>
                  <div className="hero-metric">{formatGb(currentMonthUsageGb)}</div>
                  <p>
                    Day {monthlySignal.dayOfMonth} of {monthlySignal.daysInMonth} · {numberFmt.format(monthlySignal.usageVsMonthlyPct)}% of monthly entitlement used
                  </p>
                </div>
                <div className="monthly-signal-card">
                  <span className={`signal-pill signal-${monthlySignal.tone}`}>{monthlySignal.status}</span>
                  <strong>{numberFmt.format(monthlySignal.projectedVsMonthlyPct)}% projected</strong>
                  <p>{monthlySignal.guidance}</p>
                </div>
              </section>

              <section className="monthly-summary-grid">
                <KpiCard label="Monthly Entitlement" value={formatGb(quota.monthlyQuotaGb)} subtext="Average monthly allowance derived from the annual 46 TB quota." />
                <KpiCard label="Projected Month End" value={formatGb(monthlySignal.projectedUsageGb)} tone={monthlyToneClass} subtext={`Current daily average: ${formatGb(monthlySignal.dailyAverageGb)} per day.`} />
                <KpiCard label="Remaining This Month" value={formatGb(monthlySignal.remainingMonthlyGb)} tone={monthlySignal.remainingMonthlyGb < 0 ? "metric-danger" : ""} subtext={`${monthlySignal.daysRemaining} days left · ${formatGb(monthlySignal.dailyAllowanceGb)} daily headroom.`} />
                <KpiCard label="Usage Pace" value={`${numberFmt.format(monthlySignal.pacePct)}%`} tone={monthlyToneClass} subtext={`Expected by today: ${formatGb(monthlySignal.expectedUsageGb)}.`} />
                <KpiCard label="Top CP Code" value={topCpCode ? topCpCode.cpCode : "-"} subtext={topCpCode ? `${topCpCode.cpName} · ${formatGb(topCpCode.usageGb)}` : "No CP Code data available."} />
                <KpiCard label="Daily Report Total" value={dailyTotalGb > 0 ? formatGb(dailyTotalGb) : "-"} subtext={`${dashboardData.dailyUsage.length} daily usage rows · Generated ${asOfDate}.`} />
              </section>

              <section className="panel monthly-progress-panel">
                <div className="panel-header">
                  <div>
                    <div className="label">Monthly Progress</div>
                    <h2>Usage against controllable monthly entitlement</h2>
                  </div>
                  <strong className={monthlyToneClass}>{formatGb(monthlySignal.remainingMonthlyGb)} remaining</strong>
                </div>
                <div className="stacked-progress">
                  <div>
                    <div className="progress-line-label">
                      <span>Actual usage</span>
                      <strong>{numberFmt.format(monthlySignal.usageVsMonthlyPct)}%</strong>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill monthly-actual-fill" style={{ width: monthlyProgressWidth }} />
                    </div>
                  </div>
                  <div>
                    <div className="progress-line-label">
                      <span>Projected month end</span>
                      <strong className={monthlyToneClass}>{numberFmt.format(monthlySignal.projectedVsMonthlyPct)}%</strong>
                    </div>
                    <div className="progress-track">
                      <div className={`progress-fill monthly-projected-fill fill-${monthlySignal.tone}`} style={{ width: projectedProgressWidth }} />
                    </div>
                  </div>
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
                    <div className="label">Annual Context</div>
                    <h2>Quota utilization for year-to-date visibility</h2>
                  </div>
                  <strong className={remainingTone}>{formatGb(quota.remainingQuotaGb)} remaining</strong>
                </div>
                <div className="annual-context-grid">
                  <div className="annual-stat">
                    <span>YTD Usage</span>
                    <strong>{formatGb(quota.ytdUsageGb)}</strong>
                    <small>Monthly Summary plus daily updates</small>
                  </div>
                  <div className="annual-stat">
                    <span>Annual Quota</span>
                    <strong>{formatTb(dashboardData.customer.annualQuotaTb)}</strong>
                    <small>{numberFmt.format(quota.annualQuotaGb)} GB at {dashboardData.customer.tbToGbFactor} GB per TB</small>
                  </div>
                  <div className="annual-stat">
                    <span>Annual Utilization</span>
                    <strong className={percentClass(quota.quotaUtilizationPct)}>{numberFmt.format(quota.quotaUtilizationPct)}%</strong>
                    <small>{numberFmt.format(quota.prorataUtilizationPct)}% of elapsed quota</small>
                  </div>
                </div>
                <div className="progress-track annual-progress-track">
                  <div className="progress-fill" style={{ width: progressWidth }} />
                </div>
                <div className="progress-meta">
                  <span>YTD usage {formatGb(quota.ytdUsageGb)}</span>
                  <span>Annual quota {formatGb(quota.annualQuotaGb)}</span>
                </div>
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
                  <strong>Daily report total</strong>
                  <span>{dailyTotalGb > 0 ? `${asOfDate} · ${formatGb(dailyTotalGb)} across ${dashboardData.dailyUsage.length} rows` : "No daily usage rows available."}</span>
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
