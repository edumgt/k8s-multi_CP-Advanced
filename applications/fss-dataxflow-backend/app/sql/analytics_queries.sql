-- Active workloads using ANSI SQL.
SELECT workload_name, owner_name, workload_status
FROM lab_workloads
WHERE workload_status <> 'STOPPED'
ORDER BY updated_at DESC;

-- Recent DAG durations.
SELECT dag_name, run_date, duration_seconds
FROM (
  SELECT
    dag_name,
    run_date,
    duration_seconds,
    ROW_NUMBER() OVER (PARTITION BY dag_name ORDER BY run_date DESC) AS row_num
  FROM dag_runtime_summary
) ranked
WHERE row_num <= 5
ORDER BY dag_name, run_date DESC;

-- Notebook usage summary.
SELECT notebook_name, owner_name, execution_count
FROM notebook_usage
ORDER BY execution_count DESC;
