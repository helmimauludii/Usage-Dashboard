# Prompt to use in Codex

Build a production-ready version of the Akamai Usage Monitoring & Quota Tracker based on the static prototype in `prototype/index.html`.

Requirements:
1. Create a maintainable web app, preferably with React + Vite for frontend. Use a simple backend if needed for CSV ingestion and API endpoints.
2. Implement CSV ingestion for Akamai Billing Scheduled Reports:
   - Summary CSV
   - Daily usage CSV
   - CP Code CSV
3. Store parsed data in a database or local JSON/SQLite for initial development.
4. Support configurable customer quota. Default customer:
   - Customer: Komdigi
   - Annual quota: 46 TB/year
   - Unit conversion: 1 TB = 1000 GB unless changed in config.
5. Dashboard must show:
   - YTD Usage
   - Annual Quota
   - Remaining Annual Quota
   - Quota Utilization %
   - Pro-rata YTD quota
   - Current month usage
   - Monthly usage trend
   - Top CP Code by usage
   - CP Code detail table
6. Important calculation rules:
   - Do not sum cumulative daily usage snapshots.
   - Use Summary CSV for monthly totals/YTD.
   - For current month, use the latest available Summary CSV snapshot.
   - Remaining quota = annual quota GB - YTD usage GB. Use wording “Remaining quota,” not “over quota.” If negative, show negative remaining quota clearly.
7. Add README with setup, run, and deployment instructions.
8. Add sample config file for customer quota.
9. Keep UI professional and customer-facing.
10. Add validation messages for missing or invalid CSV columns.

Use the current static HTML prototype only as a visual and functional reference, not as final architecture.
