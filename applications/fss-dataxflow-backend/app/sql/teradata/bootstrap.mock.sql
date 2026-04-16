-- PostgreSQL mock bootstrap template for Teradata-like workflow tests.
-- Each executable block is separated by '--@@'.

--@@
CREATE TABLE IF NOT EXISTS platform_meta_common_code (
  code_group VARCHAR(64) NOT NULL,
  code_value VARCHAR(64) NOT NULL,
  code_label VARCHAR(256) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active CHAR(1) NOT NULL DEFAULT 'Y',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (code_group, code_value)
);

--@@
CREATE TABLE IF NOT EXISTS platform_meta_account (
  username VARCHAR(128) PRIMARY KEY,
  role_code VARCHAR(32) NOT NULL,
  display_name VARCHAR(128) NOT NULL,
  is_active CHAR(1) NOT NULL DEFAULT 'Y',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

--@@
CREATE TABLE IF NOT EXISTS platform_batch_job (
  job_id VARCHAR(128) PRIMARY KEY,
  job_name VARCHAR(256) NOT NULL,
  source_system VARCHAR(64) NOT NULL,
  source_table_name VARCHAR(256) NOT NULL,
  target_system VARCHAR(64) NOT NULL,
  target_table_name VARCHAR(256) NOT NULL,
  schedule_cron VARCHAR(64),
  load_condition VARCHAR(2048),
  procedure_name VARCHAR(128),
  compiled_flag CHAR(1) NOT NULL DEFAULT 'N',
  is_active CHAR(1) NOT NULL DEFAULT 'Y',
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

--@@
CREATE TABLE IF NOT EXISTS platform_batch_run_log (
  run_id BIGSERIAL PRIMARY KEY,
  job_id VARCHAR(128) NOT NULL,
  run_status VARCHAR(32) NOT NULL,
  run_note VARCHAR(2000),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

--@@
CREATE TABLE IF NOT EXISTS lab_workloads (
  workload_name VARCHAR(128) PRIMARY KEY,
  owner_name VARCHAR(128) NOT NULL,
  workload_status VARCHAR(32) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

--@@
CREATE TABLE IF NOT EXISTS dag_runtime_summary (
  dag_name VARCHAR(128) NOT NULL,
  run_date TIMESTAMP NOT NULL,
  duration_seconds INTEGER NOT NULL,
  PRIMARY KEY (dag_name, run_date)
);

--@@
CREATE TABLE IF NOT EXISTS notebook_usage (
  notebook_name VARCHAR(256) NOT NULL,
  owner_name VARCHAR(128) NOT NULL,
  execution_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notebook_name, owner_name)
);

--@@
CREATE OR REPLACE PROCEDURE sp_platform_log_batch_run (
  IN p_job_id VARCHAR(128),
  IN p_run_status VARCHAR(32),
  IN p_run_note VARCHAR(2000)
)
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO platform_batch_run_log (job_id, run_status, run_note, created_at)
  VALUES (p_job_id, p_run_status, p_run_note, CURRENT_TIMESTAMP);
END;
$$;

--@@
CREATE OR REPLACE PROCEDURE sp_platform_touch_job (
  IN p_job_id VARCHAR(128)
)
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE platform_batch_job
     SET updated_at = CURRENT_TIMESTAMP
   WHERE job_id = p_job_id;
END;
$$;

--@@
INSERT INTO platform_meta_common_code (code_group, code_value, code_label, sort_order, is_active)
VALUES ('ROLE', 'ADMIN', 'Administrator', 1, 'Y')
ON CONFLICT (code_group, code_value) DO UPDATE
SET code_label = EXCLUDED.code_label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

--@@
INSERT INTO platform_meta_common_code (code_group, code_value, code_label, sort_order, is_active)
VALUES ('ROLE', 'USER', 'User', 2, 'Y')
ON CONFLICT (code_group, code_value) DO UPDATE
SET code_label = EXCLUDED.code_label,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

--@@
INSERT INTO platform_meta_account (username, role_code, display_name, is_active)
VALUES ('admin@test.com', 'ADMIN', 'Platform Admin', 'Y')
ON CONFLICT (username) DO UPDATE
SET role_code = EXCLUDED.role_code,
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

--@@
INSERT INTO platform_meta_account (username, role_code, display_name, is_active)
VALUES ('test1@test.com', 'USER', 'Test User 1', 'Y')
ON CONFLICT (username) DO UPDATE
SET role_code = EXCLUDED.role_code,
    display_name = EXCLUDED.display_name,
    is_active = EXCLUDED.is_active,
    updated_at = CURRENT_TIMESTAMP;

--@@
INSERT INTO lab_workloads (workload_name, owner_name, workload_status, updated_at)
VALUES
  ('airflow-daily-sync', 'platform-team', 'RUNNING', CURRENT_TIMESTAMP - INTERVAL '5 minutes'),
  ('jupyter-eda-session', 'data-science', 'IDLE', CURRENT_TIMESTAMP - INTERVAL '12 minutes'),
  ('mongodb-cache-refresh', 'backend', 'QUEUED', CURRENT_TIMESTAMP - INTERVAL '20 minutes'),
  ('legacy-batch-stop', 'legacy-team', 'STOPPED', CURRENT_TIMESTAMP - INTERVAL '1 day')
ON CONFLICT (workload_name) DO UPDATE
SET owner_name = EXCLUDED.owner_name,
    workload_status = EXCLUDED.workload_status,
    updated_at = EXCLUDED.updated_at;

--@@
INSERT INTO dag_runtime_summary (dag_name, run_date, duration_seconds)
VALUES
  ('dag_airflow_daily_sync', CURRENT_TIMESTAMP - INTERVAL '1 day', 420),
  ('dag_airflow_daily_sync', CURRENT_TIMESTAMP - INTERVAL '2 day', 405),
  ('dag_airflow_daily_sync', CURRENT_TIMESTAMP - INTERVAL '3 day', 398),
  ('dag_jupyter_eda_session', CURRENT_TIMESTAMP - INTERVAL '1 day', 180),
  ('dag_jupyter_eda_session', CURRENT_TIMESTAMP - INTERVAL '2 day', 172),
  ('dag_jupyter_eda_session', CURRENT_TIMESTAMP - INTERVAL '3 day', 190)
ON CONFLICT (dag_name, run_date) DO UPDATE
SET duration_seconds = EXCLUDED.duration_seconds;

--@@
INSERT INTO notebook_usage (notebook_name, owner_name, execution_count, updated_at)
VALUES
  ('eda_customer_churn.ipynb', 'data-science', 42, CURRENT_TIMESTAMP - INTERVAL '1 hour'),
  ('elt_monitoring.ipynb', 'platform-team', 27, CURRENT_TIMESTAMP - INTERVAL '2 hour'),
  ('model_feature_store.ipynb', 'ml-team', 18, CURRENT_TIMESTAMP - INTERVAL '6 hour')
ON CONFLICT (notebook_name, owner_name) DO UPDATE
SET execution_count = EXCLUDED.execution_count,
    updated_at = EXCLUDED.updated_at;
