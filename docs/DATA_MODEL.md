# Suggested Data Model

## customers
- id
- name
- annual_quota_tb
- tb_to_gb_factor
- contract_id
- product_name
- active

## usage_summary
- id
- customer_id
- report_month
- usage_gb
- hits
- peak_mbps
- p95_mbps
- data_status
- source_file
- report_generated_date
- ingested_at

## usage_daily
- id
- customer_id
- usage_date
- report_month
- statistic_type
- uom
- value
- source_file
- report_generated_date
- ingested_at

## usage_cp_code
- id
- customer_id
- report_month
- cp_code
- cp_name
- usage_gb
- hits
- source_file
- report_generated_date
- ingested_at

## ingestion_runs
- id
- source_file
- file_type
- status
- row_count
- error_message
- ingested_at
