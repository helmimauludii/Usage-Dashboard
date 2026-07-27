import fs from "node:fs";
import path from "node:path";
import { defaultCustomer } from "../src/data/sampleData.js";
import { parseAkamaiCsv } from "../src/lib/csv.js";

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

function readCsvIfProvided(filePath, fileType) {
  if (!filePath) return { rows: [], sourceFile: null };
  const text = fs.readFileSync(filePath, "utf8");
  const sourceFile = path.basename(filePath);
  return {
    rows: parseAkamaiCsv(text, fileType, sourceFile),
    sourceFile,
  };
}

function readExistingDataIfProvided(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      monthly: [],
      dailyUsage: [],
      cpCode: [],
      sourceFiles: [],
      ingestionRuns: [],
    };
  }

  const existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return {
    monthly: existing.monthly || [],
    dailyUsage: existing.dailyUsage || [],
    cpCode: existing.cpCode || [],
    sourceFiles: existing.sourceFiles || [],
    ingestionRuns: existing.ingestionRuns || [],
  };
}

function mergeByKey(existingRows, newRows, keyFields) {
  const merged = new Map();
  existingRows.forEach((row) => {
    merged.set(keyFields.map((field) => row[field]).join("|"), row);
  });
  newRows.forEach((row) => {
    merged.set(keyFields.map((field) => row[field]).join("|"), row);
  });
  return [...merged.values()];
}

function latestAsOf(rows) {
  return [...rows]
    .map((row) => row.reportGeneratedDate)
    .filter(Boolean)
    .sort()
    .at(-1);
}

const args = parseArgs(process.argv.slice(2));
const outPath = args.out || "public/data/komdigi-usage.json";
const existing = readExistingDataIfProvided(args.existing || outPath);
const backfill = readCsvIfProvided(args.backfill, "summary");
const dailySummary = readCsvIfProvided(args.summary, "summary");
const dailyUsage = readCsvIfProvided(args.daily, "daily");
const cpCode = readCsvIfProvided(args["cp-code"], "cpCode");

const baseMonthlyRows = backfill.rows.length > 0 ? backfill.rows : existing.monthly;
const monthly = mergeByKey(baseMonthlyRows, dailySummary.rows, ["reportMonth"]).sort((a, b) =>
  a.reportMonth.localeCompare(b.reportMonth),
);
const dailyRows = dailyUsage.rows.length > 0 ? dailyUsage.rows : existing.dailyUsage;
const cpCodeRows = mergeByKey(cpCode.rows.length > 0 ? [] : existing.cpCode, cpCode.rows, ["reportMonth", "cpCode", "cpName"]).sort(
  (a, b) => b.usageGb - a.usageGb,
);
const sourceFiles = [...new Set([...existing.sourceFiles, backfill.sourceFile, dailySummary.sourceFile, dailyUsage.sourceFile, cpCode.sourceFile].filter(Boolean))];
const ingestionRuns = [
  ...existing.ingestionRuns,
  { fileType: "backfill-summary", sourceFile: backfill.sourceFile, status: backfill.sourceFile ? "success" : "skipped", rowCount: backfill.rows.length },
  { fileType: "daily-summary", sourceFile: dailySummary.sourceFile, status: dailySummary.sourceFile ? "success" : "skipped", rowCount: dailySummary.rows.length },
  { fileType: "daily-usage", sourceFile: dailyUsage.sourceFile, status: dailyUsage.sourceFile ? "success" : "skipped", rowCount: dailyRows.length },
  { fileType: "cp-code", sourceFile: cpCode.sourceFile, status: cpCode.sourceFile ? "success" : "skipped", rowCount: cpCodeRows.length },
].slice(-40);

const output = {
  customer: defaultCustomer,
  asOfDate: latestAsOf([...monthly, ...dailyRows, ...cpCodeRows]),
  generatedAt: new Date().toISOString(),
  sourceFiles,
  monthly,
  dailyUsage: dailyRows,
  cpCode: cpCodeRows,
  ingestionRuns,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
