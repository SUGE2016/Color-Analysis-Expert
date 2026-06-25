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
