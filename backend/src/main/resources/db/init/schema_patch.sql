-- 修复项目新增的 dataset_groups 与 datasets 扩展字段

-- templates 表（projects.template_id FK 依赖，若已存在则跳过）
CREATE TABLE IF NOT EXISTS templates (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  template_image_key VARCHAR(1024),
  regions_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS dataset_groups (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 统一字段类型，避免外键类型不兼容
ALTER TABLE dataset_groups MODIFY COLUMN id CHAR(36)
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL;

SET @scene_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'datasets'
    AND COLUMN_NAME = 'scene'
);

SET @sql_stmt := IF(
  @scene_col_exists = 0,
  'ALTER TABLE datasets ADD COLUMN scene VARCHAR(64) NULL',
  'SELECT "scene column exists"'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @group_col_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'datasets'
    AND COLUMN_NAME = 'group_id'
);

SET @sql_stmt := IF(
  @group_col_exists = 0,
  'ALTER TABLE datasets ADD COLUMN group_id CHAR(36) NULL',
  'SELECT "group_id column exists"'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE datasets MODIFY COLUMN group_id CHAR(36)
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NULL;

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'datasets'
    AND CONSTRAINT_NAME = 'fk_datasets_group'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql_stmt := IF(
  @fk_exists = 0,
  'ALTER TABLE datasets ADD CONSTRAINT fk_datasets_group FOREIGN KEY (group_id) REFERENCES dataset_groups(id)',
  'SELECT "fk_datasets_group exists"'
);
PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- regions 表（区域标注）
CREATE TABLE IF NOT EXISTS regions (
  id CHAR(36) PRIMARY KEY,
  image_id CHAR(36) NOT NULL,
  region_id VARCHAR(128),
  name VARCHAR(255),
  type VARCHAR(64),
  points JSON,
  bounding_box JSON,
  color VARCHAR(32),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (image_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- project analysis v2: multi-dataset drafts and observable asynchronous tasks
ALTER TABLE projects MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'draft';
ALTER TABLE tasks MODIFY COLUMN status VARCHAR(32) NOT NULL DEFAULT 'queued';

SET @project_snapshot_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'template_snapshot'
);
SET @sql_stmt := IF(@project_snapshot_exists = 0,
  'ALTER TABLE projects ADD COLUMN template_snapshot JSON NULL AFTER config',
  'SELECT "template_snapshot exists"');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @project_id_collation := (
  SELECT COLLATION_NAME FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'id'
);
SET @sql_stmt := CONCAT(
  'CREATE TABLE IF NOT EXISTS project_datasets (',
  'project_id CHAR(36) NOT NULL, dataset_id CHAR(36) NOT NULL, ',
  'PRIMARY KEY (project_id, dataset_id), ',
  'CONSTRAINT fk_project_datasets_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE, ',
  'CONSTRAINT fk_project_datasets_dataset FOREIGN KEY (dataset_id) REFERENCES datasets(id)) ',
  'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=', @project_id_collation
);
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

INSERT IGNORE INTO project_datasets(project_id, dataset_id)
SELECT id, dataset_id FROM projects WHERE dataset_id IS NOT NULL;

SET @task_progress_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'progress'
);
SET @sql_stmt := IF(@task_progress_exists = 0,
  'ALTER TABLE tasks ADD COLUMN progress INT NOT NULL DEFAULT 0 AFTER status',
  'SELECT "task progress exists"');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @task_step_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'current_step'
);
SET @sql_stmt := IF(@task_step_exists = 0,
  'ALTER TABLE tasks ADD COLUMN current_step VARCHAR(128) NULL AFTER progress',
  'SELECT "task current_step exists"');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @task_cancel_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks' AND COLUMN_NAME = 'cancel_requested'
);
SET @sql_stmt := IF(@task_cancel_exists = 0,
  'ALTER TABLE tasks ADD COLUMN cancel_requested BOOLEAN NOT NULL DEFAULT FALSE AFTER current_step',
  'SELECT "task cancel_requested exists"');
PREPARE stmt FROM @sql_stmt; EXECUTE stmt; DEALLOCATE PREPARE stmt;
