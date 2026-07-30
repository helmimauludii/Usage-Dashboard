import fs from "node:fs";
import { calculateQuota } from "../src/lib/quota.js";
import { formatGb, formatMonth, numberFmt } from "../src/lib/formatters.js";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    args[key] = argv[index + 1];
    index += 1;
  }
  return args;
}

function readJson(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
      status: "Follow-up needed this month",
      projectedUsageGb,
      dailyAverageGb,
      remainingMonthlyGb,
      usageVsMonthlyPct,
      projectedVsMonthlyPct,
      pacePct,
      dailyAllowanceGb,
      daysRemaining,
    };
  }

  if (projectedVsMonthlyPct >= 85 || pacePct >= 110) {
    return {
      status: "Monitor closely",
      projectedUsageGb,
      dailyAverageGb,
      remainingMonthlyGb,
      usageVsMonthlyPct,
      projectedVsMonthlyPct,
      pacePct,
      dailyAllowanceGb,
      daysRemaining,
    };
  }

  return {
    status: "On a controlled pace",
    projectedUsageGb,
    dailyAverageGb,
    remainingMonthlyGb,
    usageVsMonthlyPct,
    projectedVsMonthlyPct,
    pacePct,
    dailyAllowanceGb,
    daysRemaining,
  };
}

function buildMessage(data, dashboardUrl) {
  const monthlyRows = [...(data.monthly || [])].sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));
  const cpCodeRows = [...(data.cpCode || [])].sort((a, b) => b.usageGb - a.usageGb);
  const quota = calculateQuota(data.customer, monthlyRows, data.asOfDate);
  const currentUsageGb = quota.currentMonth?.usageGb || 0;
  const signal = monthlyControlSignal(currentUsageGb, quota.monthlyQuotaGb, data.asOfDate);
  const topCpCode = cpCodeRows.at(0);

  const lines = [
    "Komdigi Akamai Usage Update",
    `Date: ${data.asOfDate}`,
    "",
    `Current Month: ${quota.currentMonth ? formatMonth(quota.currentMonth.reportMonth) : "-"}`,
    `Current Month Usage: ${formatGb(currentUsageGb)}`,
    `Monthly Allocation: ${formatGb(quota.monthlyQuotaGb)}`,
    `Usage vs Allocation: ${numberFmt.format(signal.usageVsMonthlyPct)}%`,
    `Projected Month End: ${formatGb(signal.projectedUsageGb)} (${numberFmt.format(signal.projectedVsMonthlyPct)}%)`,
    `Remaining This Month: ${formatGb(signal.remainingMonthlyGb)}`,
    `Daily Headroom: ${formatGb(signal.dailyAllowanceGb)} for ${signal.daysRemaining} days`,
    `Status: ${signal.status}`,
    "",
    `YTD Usage: ${formatGb(quota.ytdUsageGb)}`,
    `Annual Remaining: ${formatGb(quota.remainingQuotaGb)}`,
  ];

  if (topCpCode) {
    lines.push("", `Top CP Code: ${topCpCode.cpCode}`, `${topCpCode.cpName} - ${formatGb(topCpCode.usageGb)}`);
  }

  lines.push("", `Dashboard: ${dashboardUrl}`);
  return lines.join("\n");
}

async function sendTelegramMessage(token, chatId, message) {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Telegram API returned HTTP ${response.status}: ${body}`);
  }
}

const args = parseArgs(process.argv.slice(2));
const data = readJson(args.data || "public/data/komdigi-usage.json");
const previous = readJson(args.previous);
const dashboardUrl = args["dashboard-url"] || process.env.DASHBOARD_URL || "https://helmimauludii.github.io/Usage-Dashboard/";
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!data) {
  throw new Error("Dashboard data file was not found.");
}

if (!token || !chatId) {
  console.log("Telegram secrets are not configured. Skipping notification.");
  process.exit(0);
}

if (previous?.asOfDate === data.asOfDate && args.force !== "true") {
  console.log(`Dashboard data is still ${data.asOfDate}. Skipping duplicate notification.`);
  process.exit(0);
}

const message = buildMessage(data, dashboardUrl);
await sendTelegramMessage(token, chatId, message);
console.log(`Sent Telegram notification for ${data.asOfDate}.`);
