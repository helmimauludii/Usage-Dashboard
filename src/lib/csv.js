const SUMMARY_REQUIRED = ["reportMonth", "usageGb"];
const DAILY_REQUIRED = ["usageDate", "value"];
const CP_CODE_REQUIRED = ["cpCode", "usageGb"];

const FIELD_ALIASES = {
  reportMonth: ["report month", "period", "month", "billing month", "report_month"],
  usageDate: ["date", "usage date", "usage_date", "day", "usage start date"],
  usageEndDate: ["usage end date", "end date"],
  usageGb: ["usage gb", "usage_gb", "total usage gb", "traffic gb", "gb", "volume gb", "usage"],
  hits: ["hits", "requests", "total hits"],
  p95Mbps: ["95/5 mbps", "95th mbps", "p95 mbps", "p95_mbps", "95/5"],
  peakMbps: ["peak mbps", "peak_mbps", "max mbps"],
  dataStatus: ["status", "data status", "data_status", "usage data status"],
  statisticType: ["statistic type", "metric", "statistic_type"],
  uom: ["uom", "unit", "unit of measure"],
  value: ["value", "amount", "units"],
  cpCode: ["cp code", "cpcode", "cp_code", "content provider code"],
  cpName: ["cp name", "domain", "hostname", "name", "cp_name", "cp code name"],
  product: ["product", "product name"],
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  const cleaned = String(value).replace(/,/g, "").replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toMonth(value) {
  const text = String(value || "").trim();
  const direct = text.match(/^(\d{4})[-/](\d{1,2})/);
  if (direct) return `${direct[1]}-${direct[2].padStart(2, "0")}`;

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
  }

  return text;
}

function reportDateFromFile(sourceFile) {
  const match = String(sourceFile || "").match(/(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : new Date().toISOString().slice(0, 10);
}

function mapHeaders(headers) {
  const normalized = headers.map(normalizeHeader);
  const mapped = {};

  Object.entries(FIELD_ALIASES).forEach(([field, aliases]) => {
    const index = normalized.findIndex((header) => aliases.includes(header));
    if (index >= 0) mapped[field] = index;
  });

  return mapped;
}

function readCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = splitCsvLine(lines[0]);
  const mapping = mapHeaders(headers);
  const rows = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return { cells, raw: line };
  });

  return { headers, mapping, rows };
}

function missingFields(mapping, required) {
  return required.filter((field) => mapping[field] === undefined);
}

function parseAkamaiSummaryMetricRows(rows, mapping, sourceFile) {
  const grouped = new Map();
  const reportGeneratedDate = reportDateFromFile(sourceFile);

  rows.forEach(({ cells }) => {
    const month = toMonth(cells[mapping.usageDate]);
    const statisticType = String(cells[mapping.statisticType] || "").trim();
    const uom = String(cells[mapping.uom] || "").trim();
    const value = parseNumber(cells[mapping.value]);
    const dataStatus = cells[mapping.dataStatus] || "Imported";

    if (!month) return;

    if (!grouped.has(month)) {
      grouped.set(month, {
        reportMonth: month,
        usageGb: 0,
        hits: 0,
        p95Mbps: 0,
        peakMbps: 0,
        dataStatus: "Data Finalized",
        sourceFile,
        reportGeneratedDate,
      });
    }

    const row = grouped.get(month);
    if (dataStatus === "Collecting Data") row.dataStatus = dataStatus;
    if (statisticType === "Bytes" && uom === "GB") row.usageGb += value;
    if (statisticType === "Hits") row.hits += value;
    if (statisticType === "95/5 Mbps") row.p95Mbps = Math.max(row.p95Mbps, value);
    if (statisticType === "Peak Mbps") row.peakMbps = Math.max(row.peakMbps, value);
  });

  return [...grouped.values()]
    .filter((row) => row.usageGb > 0 || row.hits > 0 || row.p95Mbps > 0 || row.peakMbps > 0)
    .sort((a, b) => a.reportMonth.localeCompare(b.reportMonth));
}

function parseAkamaiCpCodeMetricRows(rows, mapping, sourceFile) {
  const grouped = new Map();
  const reportGeneratedDate = reportDateFromFile(sourceFile);

  rows.forEach(({ cells }) => {
    const cpCode = String(cells[mapping.cpCode] || "").trim();
    const cpName = String(cells[mapping.cpName] || cpCode).trim();
    const month = toMonth(cells[mapping.usageDate] || new Date().toISOString().slice(0, 7));
    const statisticType = String(cells[mapping.statisticType] || "").trim();
    const uom = String(cells[mapping.uom] || "").trim();
    const value = parseNumber(cells[mapping.value]);

    if (!cpCode || cpCode === "N/A") return;

    const key = `${month}|${cpCode}|${cpName}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        reportMonth: month,
        cpCode,
        cpName,
        usageGb: 0,
        hits: 0,
        sourceFile,
        reportGeneratedDate,
      });
    }

    const row = grouped.get(key);
    if (statisticType === "Bytes" && uom === "GB") row.usageGb += value;
    if (statisticType === "Hits") row.hits += value;
  });

  return [...grouped.values()]
    .filter((row) => row.usageGb > 0 || row.hits > 0)
    .sort((a, b) => b.usageGb - a.usageGb);
}

function parseAkamaiDailyMetricRows(rows, mapping, sourceFile) {
  const reportGeneratedDate = reportDateFromFile(sourceFile);

  return rows.map(({ cells }) => ({
    usageDate: cells[mapping.usageEndDate] || cells[mapping.usageDate],
    reportMonth: toMonth(cells[mapping.usageDate]),
    statisticType: cells[mapping.statisticType] || "Usage",
    uom: cells[mapping.uom] || "",
    value: parseNumber(cells[mapping.value]),
    sourceFile,
    reportGeneratedDate,
  }));
}

export function parseAkamaiCsv(text, fileType, sourceFile) {
  const { mapping, rows } = readCsv(text);

  if (fileType === "summary") {
    const hasMetricRows =
      mapping.usageDate !== undefined &&
      mapping.value !== undefined &&
      mapping.uom !== undefined &&
      mapping.statisticType !== undefined;

    if (hasMetricRows) {
      const parsedRows = parseAkamaiSummaryMetricRows(rows, mapping, sourceFile);
      if (parsedRows.length === 0) {
        throw new Error("Summary CSV was detected, but no Bytes/GB usage rows were found.");
      }
      return parsedRows;
    }

    const missing = missingFields(mapping, SUMMARY_REQUIRED);
    if (missing.length > 0) {
      throw new Error(`Missing required Summary CSV columns: ${missing.join(", ")}.`);
    }

    return rows.map(({ cells }) => ({
      reportMonth: toMonth(cells[mapping.reportMonth]),
      usageGb: parseNumber(cells[mapping.usageGb]),
      hits: parseNumber(cells[mapping.hits]),
      p95Mbps: parseNumber(cells[mapping.p95Mbps]),
      peakMbps: parseNumber(cells[mapping.peakMbps]),
      dataStatus: cells[mapping.dataStatus] || "Imported",
      sourceFile,
      reportGeneratedDate: reportDateFromFile(sourceFile),
    }));
  }

  if (fileType === "daily") {
    const missing = missingFields(mapping, DAILY_REQUIRED);
    if (missing.length > 0) {
      throw new Error(`Missing required Daily CSV columns: ${missing.join(", ")}.`);
    }

    return parseAkamaiDailyMetricRows(rows, mapping, sourceFile);
  }

  if (fileType === "cpCode") {
    const hasMetricRows =
      mapping.cpCode !== undefined &&
      mapping.usageDate !== undefined &&
      mapping.value !== undefined &&
      mapping.uom !== undefined &&
      mapping.statisticType !== undefined;

    if (hasMetricRows) {
      const parsedRows = parseAkamaiCpCodeMetricRows(rows, mapping, sourceFile);
      if (parsedRows.length === 0) {
        throw new Error("CP Code CSV was detected, but no CP Code Bytes/GB usage rows were found.");
      }
      return parsedRows;
    }

    const missing = missingFields(mapping, CP_CODE_REQUIRED);
    if (missing.length > 0) {
      throw new Error(`Missing required CP Code CSV columns: ${missing.join(", ")}.`);
    }

    return rows.map(({ cells }) => ({
      reportMonth: toMonth(cells[mapping.reportMonth] || new Date().toISOString().slice(0, 7)),
      cpCode: cells[mapping.cpCode],
      cpName: cells[mapping.cpName] || cells[mapping.cpCode],
      usageGb: parseNumber(cells[mapping.usageGb]),
      hits: parseNumber(cells[mapping.hits]),
      sourceFile,
      reportGeneratedDate: reportDateFromFile(sourceFile),
    }));
  }

  throw new Error(`Unsupported CSV type: ${fileType}.`);
}
