# Akamai Usage Monitoring & Quota Tracker

Customer-facing dashboard for monitoring Akamai usage against contracted quota.

## Current App

The static prototype in `prototype/index.html` has been converted into a maintainable React + Vite app.

Implemented:
- Executive dashboard with YTD usage, annual quota, remaining quota, utilization, pro-rata quota, current month, and top CP Code.
- Read-only Komdigi customer dashboard powered by `public/data/komdigi-usage.json`.
- One-time YTD/monthly Summary backfill plus daily Summary merge by month.
- Daily CSV parsing for current-month cumulative snapshots only, not YTD calculations.
- CP Code CSV parsing with chart and detail table.
- Internal customer quota config with Komdigi defaults.
- Validation messages for missing required CSV columns.

## Run Locally

```bash
npm install
npm run dev
```

Then open the Vite URL shown in the terminal.

## Build

```bash
npm run build
npm run preview
```

## Generate Dashboard Data

Generate the read-only dashboard JSON from one YTD backfill file plus the latest daily scheduled report exports:

```bash
npm run data:komdigi -- \
  --backfill "/path/to/YTD 2026-Summary-2026-07-06.csv" \
  --summary "/path/to/Daily Usage Komdigi-Summary-2026-07-06.csv" \
  --daily "/path/to/Daily Usage Komdigi-Daily usage-2026-07-06.csv" \
  --cp-code "/path/to/Daily Usage Komdigi-CP Code data-2026-07-06.csv" \
  --out public/data/komdigi-usage.json
```

Merge rule:
- YTD/monthly Summary is used as the historical backfill.
- Daily Summary updates or adds the current reporting month by `reportMonth`.
- Daily usage rows are stored as cumulative snapshots and are not summed into YTD.
- CP Code rows update the current-month breakdown.

## Daily Automation

Daily automation is included in `.github/workflows/update-komdigi-data.yml`.

The workflow:
- runs every day at 08:00 Jakarta time
- reads the Akamai scheduled-report mailbox over IMAP
- downloads the latest Summary, Daily usage, and CP Code CSV attachments
- merges them into `public/data/komdigi-usage.json`
- builds the dashboard
- commits only the updated dashboard JSON

Configure these GitHub repository secrets:

```text
AKAMAI_IMAP_HOST
AKAMAI_IMAP_PORT
AKAMAI_IMAP_USER
AKAMAI_IMAP_PASSWORD
AKAMAI_IMAP_MAILBOX
```

Optional repository variables:

```text
AKAMAI_MAIL_SUBJECT_FILTER=Daily Usage Komdigi
AKAMAI_SEARCH_SINCE_DAYS=3
```

Raw CSV attachments are downloaded into `data/raw/YYYY-MM-DD/` during the workflow, but CSV files are ignored by git. The dashboard consumes only `public/data/komdigi-usage.json`.

For local testing after setting the same environment variables:

```bash
npm run fetch:akamai -- --out-root data/raw
```

## Internal Customer Config

Use `config.sample.json` as the starting contract configuration. This is internal project configuration, not a customer-facing dashboard input:

```json
{
  "customer": {
    "id": "komdigi",
    "name": "Komdigi",
    "contractId": "V-5D9NTHX",
    "productName": "App & API Protector Plus DSA",
    "annualQuotaTb": 46,
    "tbToGbFactor": 1000,
    "contractStartMonth": "2026-01",
    "active": true
  }
}
```

## CSV Inputs

Akamai Control Center > Billing > Scheduled Report sends CSV attachments by email:
- Summary CSV
- Daily usage CSV
- CP Code CSV

Accepted Summary CSV fields are matched by common header names:
- `report month`, `period`, `month`, or `billing month`
- `usage gb`, `total usage gb`, `traffic gb`, `gb`, or `usage`
- Optional: `hits`, `95/5 mbps`, `peak mbps`, `data status`
- Akamai metric-row exports are also supported: `Usage Start Date`, `Units`, `UoM`, `Statistic Type`, and `Usage Data Status`

Accepted Daily CSV fields:
- `Usage Start Date`
- `Usage End Date`
- `Units`
- `UoM`
- `Statistic Type`

Accepted CP Code CSV fields:
- `cp code`
- `usage gb`
- Optional: `cp name`, `domain`, `hits`, `report month`
- Akamai metric-row exports are also supported: `Cp Code`, `Cp Code Name`, `Units`, `UoM`, and `Statistic Type`

## Calculation Rules

- Do not sum cumulative daily usage snapshots.
- Use Summary CSV rows for monthly totals and YTD usage.
- Current month usage is the latest available Summary CSV month.
- Remaining quota = annual quota GB - YTD usage GB.
- Keep dashboard wording as "Remaining quota"; if usage exceeds quota, show negative remaining quota clearly.
- Default Komdigi quota is 46 TB/year with 1 TB = 1000 GB unless contract config changes.

## Production Path

Recommended next steps:
- Add mailbox automation for scheduled Akamai CSV attachments.
- Run `scripts/generate-dashboard-data.mjs` from a scheduled job or GitHub Action.
- Commit or publish only `public/data/komdigi-usage.json` to the dashboard deployment.
- Archive raw CSV files in private storage if audit retention is required.
- Add authentication or IP allowlisting before sharing the dashboard externally.
