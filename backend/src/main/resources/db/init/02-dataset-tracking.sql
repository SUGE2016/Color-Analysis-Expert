-- 学年、作品元数据（分组/数据集/图片）

SET @db := DATABASE();

-- dataset_groups.academic_year
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'dataset_groups' AND COLUMN_NAME = 'academic_year');
SET @sql := IF(@c = 0,
  'ALTER TABLE dataset_groups ADD COLUMN academic_year INT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- datasets.academic_year
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'datasets' AND COLUMN_NAME = 'academic_year');
SET @sql := IF(@c = 0,
  'ALTER TABLE datasets ADD COLUMN academic_year INT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- images 作品元数据
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'images' AND COLUMN_NAME = 'subject_code');
SET @sql := IF(@c = 0,
  'ALTER TABLE images ADD COLUMN subject_code VARCHAR(64) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'images' AND COLUMN_NAME = 'label');
SET @sql := IF(@c = 0,
  'ALTER TABLE images ADD COLUMN label VARCHAR(255) NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'images' AND COLUMN_NAME = 'captured_at');
SET @sql := IF(@c = 0,
  'ALTER TABLE images ADD COLUMN captured_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
