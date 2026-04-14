-- Teradata bootstrap template for this platform.
-- Each executable block is separated by '--@@'.
-- Keep one full SQL statement per block.
--
-- Required privileges for PLATFORM_TERADATA_USER:
-- - CREATE TABLE, INSERT, UPDATE
-- - REPLACE PROCEDURE
--
-- Objects are created in PLATFORM_TERADATA_DATABASE.

--@@
CREATE MULTISET TABLE platform_meta_common_code (
  code_group VARCHAR(64) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  code_value VARCHAR(64) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  code_label VARCHAR(256) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active CHAR(1) CHARACTER SET LATIN NOT CASESPECIFIC NOT NULL DEFAULT 'Y',
  created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
PRIMARY INDEX (code_group, code_value);

--@@
CREATE MULTISET TABLE platform_meta_account (
  username VARCHAR(128) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  role_code VARCHAR(32) CHARACTER SET LATIN NOT CASESPECIFIC NOT NULL,
  display_name VARCHAR(128) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  is_active CHAR(1) CHARACTER SET LATIN NOT CASESPECIFIC NOT NULL DEFAULT 'Y',
  created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
PRIMARY INDEX (username);

--@@
CREATE MULTISET TABLE platform_batch_job (
  job_id VARCHAR(128) CHARACTER SET LATIN NOT CASESPECIFIC NOT NULL,
  job_name VARCHAR(256) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  source_system VARCHAR(64) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  source_table_name VARCHAR(256) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  target_system VARCHAR(64) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  target_table_name VARCHAR(256) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  schedule_cron VARCHAR(64) CHARACTER SET LATIN NOT CASESPECIFIC,
  load_condition VARCHAR(2048) CHARACTER SET UNICODE NOT CASESPECIFIC,
  procedure_name VARCHAR(128) CHARACTER SET LATIN NOT CASESPECIFIC,
  compiled_flag CHAR(1) CHARACTER SET LATIN NOT CASESPECIFIC NOT NULL DEFAULT 'N',
  is_active CHAR(1) CHARACTER SET LATIN NOT CASESPECIFIC NOT NULL DEFAULT 'Y',
  created_by VARCHAR(128) CHARACTER SET UNICODE NOT CASESPECIFIC NOT NULL,
  created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
PRIMARY INDEX (job_id);

--@@
CREATE MULTISET TABLE platform_batch_run_log (
  run_id BIGINT GENERATED ALWAYS AS IDENTITY
    (START WITH 1 INCREMENT BY 1 NO CYCLE) NOT NULL,
  job_id VARCHAR(128) CHARACTER SET LATIN NOT CASESPECIFIC NOT NULL,
  run_status VARCHAR(32) CHARACTER SET LATIN NOT CASESPECIFIC NOT NULL,
  run_note VARCHAR(2000) CHARACTER SET UNICODE NOT CASESPECIFIC,
  created_at TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP
)
PRIMARY INDEX (job_id);

--@@
REPLACE PROCEDURE sp_platform_log_batch_run (
  IN p_job_id VARCHAR(128),
  IN p_run_status VARCHAR(32),
  IN p_run_note VARCHAR(2000)
)
BEGIN
  INSERT INTO platform_batch_run_log (
    job_id,
    run_status,
    run_note,
    created_at
  )
  VALUES (
    p_job_id,
    p_run_status,
    p_run_note,
    CURRENT_TIMESTAMP
  );
END;

--@@
REPLACE PROCEDURE sp_platform_touch_job (
  IN p_job_id VARCHAR(128)
)
BEGIN
  UPDATE platform_batch_job
  SET updated_at = CURRENT_TIMESTAMP
  WHERE job_id = p_job_id;
END;

--@@
INSERT INTO platform_meta_common_code (code_group, code_value, code_label, sort_order, is_active)
VALUES ('ROLE', 'ADMIN', 'Administrator', 1, 'Y');

--@@
INSERT INTO platform_meta_common_code (code_group, code_value, code_label, sort_order, is_active)
VALUES ('ROLE', 'USER', 'User', 2, 'Y');

--@@
INSERT INTO platform_meta_common_code (code_group, code_value, code_label, sort_order, is_active)
VALUES ('JOB_STATUS', 'DRAFT', 'Draft', 1, 'Y');

--@@
INSERT INTO platform_meta_common_code (code_group, code_value, code_label, sort_order, is_active)
VALUES ('JOB_STATUS', 'ACTIVE', 'Active', 2, 'Y');

--@@
INSERT INTO platform_meta_common_code (code_group, code_value, code_label, sort_order, is_active)
VALUES ('RUN_STATUS', 'SUCCESS', 'Success', 1, 'Y');

--@@
INSERT INTO platform_meta_common_code (code_group, code_value, code_label, sort_order, is_active)
VALUES ('RUN_STATUS', 'FAILED', 'Failed', 2, 'Y');

--@@
INSERT INTO platform_meta_account (username, role_code, display_name, is_active)
VALUES ('admin@test.com', 'ADMIN', 'Platform Admin', 'Y');

--@@
INSERT INTO platform_meta_account (username, role_code, display_name, is_active)
VALUES ('test1@test.com', 'USER', 'Test User 1', 'Y');
