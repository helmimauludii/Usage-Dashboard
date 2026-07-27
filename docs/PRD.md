# Product Requirements Document

## Product Name
Akamai Usage Monitoring & Quota Tracker

## Primary User
External customer and internal Telin Platform Performance team.

## Main Objective
Provide customer visibility of Akamai usage compared to contracted quota.

## Key Metrics
- Annual quota in TB
- YTD usage in GB/TB
- Remaining annual quota in GB/TB
- Quota utilization percentage
- Pro-rata YTD quota and utilization
- Monthly usage trend
- Current month usage
- Hits
- Peak Mbps
- 95/5 Mbps
- CP Code usage breakdown

## Data Inputs
1. Summary CSV
   - Period/month
   - Total usage GB
   - Hits
   - Peak Mbps
   - 95/5 Mbps
   - Data status
2. Daily Usage CSV
   - Date
   - Metric/statistic type
   - Unit/UoM
   - Value
3. CP Code CSV
   - CP code
   - CP name/domain
   - Usage GB
   - Hits

## Important Logic
- Daily usage CSV appears to be cumulative month-to-date, not pure daily increment.
- Avoid summing daily cumulative data across dates.
- For YTD tracker, use monthly summary values or latest monthly snapshot.
- Remaining quota = Annual quota GB - YTD usage GB.
- Pro-rata YTD quota = Annual quota GB * elapsed months/days ratio, depending selected method.
- Default for Komdigi: 46 TB/year = 46,000 GB if decimal TB is used.

## Dashboard Pages

### 1. Executive Overview
Cards:
- YTD Usage
- Annual Quota
- Quota Utilization
- Remaining Annual Quota
- Current Month Usage
- Pro-rata YTD Quota

Charts:
- Monthly Usage Trend
- Usage vs Monthly Average Entitlement
- Quota Utilization Progress

### 2. CP Code Detail
Charts:
- Top 10 CP Code by Usage
- Top 10 CP Code by Hits
Table:
- CP code
- Name/domain
- Usage GB
- Hits
- Share of total usage

### 3. Data/Report Status
- Last updated date
- Source file name
- Data status from Akamai
- Missing files/period warnings

## Access Control
Future production should support customer login and ensure each customer can only see their own data.

## Non-Goals for Prototype
- No billing invoice generation
- No official reconciliation with finance until data validation is completed
- No real-time Akamai API integration, since Billing scheduled report is the current source
