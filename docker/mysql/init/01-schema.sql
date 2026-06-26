-- MySQL 建表脚本：sql/schema.sql
-- 使用 CHAR(36) 存储 UUID；config 与 payload 使用 JSON 类型
-- ENGINE=InnoDB, CHARSET=utf8mb4

CREATE DATABASE IF NOT EXISTS color_analysis DEFAULT CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;
USE color_analysis;

-- 1) users
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  username VARCHAR(128) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2) datasets
CREATE TABLE IF NOT EXISTS datasets (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id CHAR(36),
  storage_prefix VARCHAR(512),
  file_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) images
CREATE TABLE IF NOT EXISTS images (
  id CHAR(36) PRIMARY KEY,
  dataset_id CHAR(36) NOT NULL,
  file_name VARCHAR(512),
  storage_key VARCHAR(1024),
  width INT, height INT,
  md5 VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (dataset_id) REFERENCES datasets(id),
  INDEX (dataset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) templates
CREATE TABLE IF NOT EXISTS templates (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  template_image_key VARCHAR(1024),
  regions_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) projects
CREATE TABLE IF NOT EXISTS projects (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  owner_id CHAR(36),
  dataset_id CHAR(36),
  template_id CHAR(36),
  config JSON,
  status ENUM('created','queued','running','completed','failed') DEFAULT 'created',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id),
  FOREIGN KEY (dataset_id) REFERENCES datasets(id),
  FOREIGN KEY (template_id) REFERENCES templates(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6) tasks
CREATE TABLE IF NOT EXISTS tasks (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36),
  task_type VARCHAR(64),
  status ENUM('pending','running','success','failed') DEFAULT 'pending',
  worker_task_id VARCHAR(128),
  params JSON,
  result JSON,
  started_at DATETIME,
  finished_at DATETIME,
  logs TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  INDEX (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7) results_summary
CREATE TABLE IF NOT EXISTS results_summary (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36),
  image_id CHAR(36),
  region_id VARCHAR(128),
  result_type VARCHAR(64),
  payload JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (image_id) REFERENCES images(id),
  INDEX (project_id),
  INDEX (image_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8) files
CREATE TABLE IF NOT EXISTS files (
  id CHAR(36) PRIMARY KEY,
  project_id CHAR(36),
  name VARCHAR(512),
  storage_key VARCHAR(1024),
  type VARCHAR(32),
  size BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9) audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  task_id CHAR(36),
  level VARCHAR(16),
  message TEXT,
  ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10) dataset_groups（数据集分组）
CREATE TABLE IF NOT EXISTS dataset_groups (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11) regions（区域标注）
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
-- scene/group_id 由 Spring schema_patch.sql 在 API 启动时补齐
