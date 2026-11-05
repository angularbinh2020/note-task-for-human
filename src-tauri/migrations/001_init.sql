CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  collapsed INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS columns (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_columns_code ON columns(code);
CREATE INDEX IF NOT EXISTS idx_columns_deleted ON columns(deleted_at);
CREATE INDEX IF NOT EXISTS idx_columns_sort ON columns(sort_order);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT NOT NULL,
  column_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (column_id) REFERENCES columns(id)
);

CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_column ON items(column_id);
CREATE INDEX IF NOT EXISTS idx_items_cat_col ON items(category_id, column_id);
CREATE INDEX IF NOT EXISTS idx_items_deleted ON items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_deleted ON categories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);
