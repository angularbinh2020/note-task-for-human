use crate::error::{AppError, AppResult};
use rusqlite::{params, Connection};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub struct DbState(pub Mutex<Connection>);

pub fn db_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::msg(format!("Không lấy được app data dir: {e}")))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("data.db"))
}

pub fn open_connection(path: &PathBuf) -> AppResult<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;",
    )?;
    Ok(conn)
}

fn table_has_column(conn: &Connection, table: &str, column: &str) -> AppResult<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let names = stmt
        .query_map([], |r| r.get::<_, String>(1))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(names.iter().any(|n| n == column))
}

fn normalize_code(code: &str) -> String {
    if code == "running" || code.starts_with("running_") {
        "running".into()
    } else if code == "pending" || code.starts_with("pending_") {
        "pending".into()
    } else {
        code.to_string()
    }
}

fn seed_default_columns(conn: &Connection) -> AppResult<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM columns", [], |r| r.get(0))?;
    if count > 0 {
        return Ok(());
    }
    let now = now_iso();
    for (name, code, sort) in [("Đang chạy", "running", 0i64), ("Chờ chạy", "pending", 1)] {
        conn.execute(
            "INSERT INTO columns (id, name, code, sort_order, deleted_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?5)",
            params![new_id(), name, code, sort, now],
        )?;
    }
    Ok(())
}

fn migrate_from_legacy(conn: &mut Connection) -> AppResult<()> {
    let tx = conn.transaction()?;
    tx.execute_batch(
        "ALTER TABLE columns RENAME TO columns_legacy;
         ALTER TABLE items RENAME TO items_legacy;",
    )?;
    tx.execute_batch(include_str!("../migrations/001_init.sql"))?;

    let legacy_cols: Vec<(String, String, String, i64, Option<String>, String, String)> = {
        let mut stmt = tx.prepare(
            "SELECT id, name, code, sort_order, deleted_at, created_at, updated_at
             FROM columns_legacy ORDER BY sort_order ASC, created_at ASC",
        )?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };

    let mut code_to_new: HashMap<String, String> = HashMap::new();
    let mut old_to_new: HashMap<String, String> = HashMap::new();

    for (old_id, name, code, sort_order, deleted_at, created_at, updated_at) in &legacy_cols {
        let norm = normalize_code(code);
        let new_id = if let Some(existing) = code_to_new.get(&norm) {
            existing.clone()
        } else {
            let id = new_id();
            let display_name = match norm.as_str() {
                "running" => "Đang chạy".to_string(),
                "pending" => "Chờ chạy".to_string(),
                _ => name.clone(),
            };
            tx.execute(
                "INSERT INTO columns (id, name, code, sort_order, deleted_at, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    id,
                    display_name,
                    norm,
                    sort_order,
                    deleted_at,
                    created_at,
                    updated_at
                ],
            )?;
            code_to_new.insert(norm, id.clone());
            id
        };
        old_to_new.insert(old_id.clone(), new_id);
    }

    let legacy_items: Vec<(
        String,
        String,
        String,
        String,
        String,
        i64,
        Option<String>,
        String,
        String,
    )> = {
        let mut stmt = tx.prepare(
            "SELECT i.id, c.category_id, i.column_id, i.name, i.description, i.sort_order,
                    i.deleted_at, i.created_at, i.updated_at
             FROM items_legacy i
             JOIN columns_legacy c ON c.id = i.column_id",
        )?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get(0)?,
                    r.get(1)?,
                    r.get(2)?,
                    r.get(3)?,
                    r.get(4)?,
                    r.get(5)?,
                    r.get(6)?,
                    r.get(7)?,
                    r.get(8)?,
                ))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };

    for (
        id,
        category_id,
        old_column_id,
        name,
        description,
        sort_order,
        deleted_at,
        created_at,
        updated_at,
    ) in legacy_items
    {
        let column_id = old_to_new
            .get(&old_column_id)
            .cloned()
            .ok_or_else(|| AppError::msg("Không map được column legacy"))?;
        tx.execute(
            "INSERT INTO items (id, category_id, column_id, name, description, sort_order, deleted_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                category_id,
                column_id,
                name,
                description,
                sort_order,
                deleted_at,
                created_at,
                updated_at
            ],
        )?;
    }

    tx.execute_batch("DROP TABLE items_legacy; DROP TABLE columns_legacy;")?;
    tx.commit()?;
    Ok(())
}

pub fn migrate(conn: &mut Connection) -> AppResult<()> {
    let columns_exist: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='columns')",
        [],
        |r| r.get(0),
    )?;

    if columns_exist && table_has_column(conn, "columns", "category_id")? {
        migrate_from_legacy(conn)?;
    } else {
        conn.execute_batch(include_str!("../migrations/001_init.sql"))?;
    }

    seed_default_columns(conn)?;
    Ok(())
}

pub fn with_db<F, T>(state: &State<'_, DbState>, f: F) -> AppResult<T>
where
    F: FnOnce(&Connection) -> AppResult<T>,
{
    let conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Database lock poisoned"))?;
    f(&conn)
}

pub fn with_db_mut<F, T>(state: &State<'_, DbState>, f: F) -> AppResult<T>
where
    F: FnOnce(&mut Connection) -> AppResult<T>,
{
    let mut conn = state
        .0
        .lock()
        .map_err(|_| AppError::msg("Database lock poisoned"))?;
    f(&mut conn)
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn validate_column_code(code: &str) -> AppResult<String> {
    let trimmed = code.trim().to_string();
    if trimmed.is_empty() {
        return Err(AppError::msg("Code cột không được để trống"));
    }
    let re = regex::Regex::new(r"^[a-zA-Z0-9_-]+$").unwrap();
    if !re.is_match(&trimmed) {
        return Err(AppError::msg(
            "Code chỉ được gồm a-z, A-Z, 0-9, _ và -",
        ));
    }
    Ok(trimmed)
}

pub fn code_exists(conn: &Connection, code: &str, exclude_id: Option<&str>) -> AppResult<bool> {
    let exists: bool = if let Some(id) = exclude_id {
        conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM columns WHERE code = ?1 AND id != ?2)",
            rusqlite::params![code, id],
            |r| r.get(0),
        )?
    } else {
        conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM columns WHERE code = ?1)",
            [code],
            |r| r.get(0),
        )?
    };
    Ok(exists)
}

pub fn next_sort_order(
    conn: &Connection,
    table: &str,
    filter_sql: &str,
    params: &[&dyn rusqlite::ToSql],
) -> AppResult<i64> {
    let sql =
        format!("SELECT COALESCE(MAX(sort_order), -1) + 1 FROM {table} WHERE {filter_sql}");
    let mut stmt = conn.prepare(&sql)?;
    let value: i64 = stmt.query_row(params, |r| r.get(0))?;
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_column_code_accepts_valid_charset_and_trims() {
        assert_eq!(validate_column_code("  running  ").unwrap(), "running");
        assert_eq!(validate_column_code("test_col-01").unwrap(), "test_col-01");
        assert_eq!(validate_column_code("ABC-xyz_123").unwrap(), "ABC-xyz_123");
    }

    #[test]
    fn validate_column_code_rejects_empty_and_invalid_charset() {
        assert!(validate_column_code("").is_err());
        assert!(validate_column_code("   ").is_err());
        // khoảng trắng ở giữa
        assert!(validate_column_code("co de").is_err());
        // tiếng Việt / ký tự đặc biệt
        assert!(validate_column_code("cột").is_err());
        assert!(validate_column_code("code!").is_err());
        assert!(validate_column_code("code@x").is_err());
    }

    #[test]
    fn validate_column_code_error_mentions_charset() {
        let err = validate_column_code("code!").unwrap_err();
        assert!(err.to_string().contains("a-z"));
    }

    #[test]
    fn code_exists_checks_all_rows_and_excludes_given_id() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../migrations/001_init.sql"))
            .unwrap();
        let now = "2026-01-01T00:00:00.000Z";
        conn.execute(
            "INSERT INTO columns (id, name, code, sort_order, deleted_at, created_at, updated_at)
             VALUES ('col-1', 'Đang chạy', 'running', 0, NULL, ?1, ?1)",
            params![now],
        )
        .unwrap();

        assert!(code_exists(&conn, "running", None).unwrap());

        // code trùng vẫn bị chặn kể cả khi bản ghi đã vào thùng rác (deleted_at)
        conn.execute(
            "UPDATE columns SET deleted_at = ?1 WHERE id = 'col-1'",
            params![now],
        )
        .unwrap();
        assert!(code_exists(&conn, "running", None).unwrap());

        // loại trừ chính record (trường hợp update giữ nguyên code)
        assert!(!code_exists(&conn, "running", Some("col-1")).unwrap());
        assert!(!code_exists(&conn, "pending", None).unwrap());
    }

    #[test]
    fn next_sort_order_returns_zero_for_empty_and_max_plus_one_otherwise() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(include_str!("../migrations/001_init.sql"))
            .unwrap();
        let now = "2026-01-01T00:00:00.000Z";

        assert_eq!(
            next_sort_order(&conn, "columns", "1=1", &[]).unwrap(),
            0
        );

        for i in 0..3 {
            conn.execute(
                "INSERT INTO columns (id, name, code, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                params![format!("col-{i}"), format!("Cột {i}"), format!("c{i}"), i, now],
            )
            .unwrap();
        }
        assert_eq!(
            next_sort_order(&conn, "columns", "1=1", &[]).unwrap(),
            3
        );
    }

    #[test]
    fn migrate_creates_schema_and_seeds_default_columns_once() {
        let mut conn = Connection::open_in_memory().unwrap();
        migrate(&mut conn).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM columns", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2);

        let running: String = conn
            .query_row(
                "SELECT name FROM columns WHERE code = 'running'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(running, "Đang chạy");
        let pending: String = conn
            .query_row(
                "SELECT name FROM columns WHERE code = 'pending'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(pending, "Chờ chạy");

        // Migrate lại (DB đã có schema + dữ liệu) → không seed thêm
        migrate(&mut conn).unwrap();
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM columns", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn migrate_merges_legacy_per_category_columns_into_global_by_code() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE categories (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                collapsed INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE columns (
                id TEXT PRIMARY KEY NOT NULL,
                category_id TEXT NOT NULL DEFAULT '',
                name TEXT NOT NULL,
                code TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE items (
                id TEXT PRIMARY KEY NOT NULL,
                category_id TEXT NOT NULL,
                column_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                sort_order INTEGER NOT NULL DEFAULT 0,
                deleted_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            INSERT INTO categories (id, name, sort_order, collapsed, created_at, updated_at)
                VALUES ('cat-1', 'Việc', 0, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
            INSERT INTO columns (id, category_id, name, code, sort_order, created_at, updated_at) VALUES
                ('col-running-1', 'cat-1', 'Đang chạy', 'running_1', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
                ('col-running-2', 'cat-1', 'Đang chạy', 'running_2', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
                ('col-pending',   'cat-1', 'Chờ chạy', 'pending',   2, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
            INSERT INTO items (id, category_id, column_id, name, sort_order, created_at, updated_at) VALUES
                ('item-1', 'cat-1', 'col-running-1', 'Việc A', 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
                ('item-2', 'cat-1', 'col-running-2', 'Việc B', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');
            ",
        )
        .unwrap();

        migrate(&mut conn).unwrap();

        // running_1 + running_2 gộp thành 1 cột 'running' → còn 2 cột global
        let col_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM columns", [], |r| r.get(0))
            .unwrap();
        assert_eq!(col_count, 2);

        // Items vẫn còn, đã map sang cột mới
        let running_items: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM items i JOIN columns c ON c.id = i.column_id WHERE c.code = 'running'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(running_items, 2);

        let names: Vec<String> = {
            let mut stmt = conn
                .prepare("SELECT name FROM items ORDER BY sort_order ASC")
                .unwrap();
            stmt.query_map([], |r| r.get(0))
                .unwrap()
                .collect::<Result<Vec<_>, _>>()
                .unwrap()
        };
        assert_eq!(names, vec!["Việc A".to_string(), "Việc B".to_string()]);

        // Bảng legacy đã bị dọn
        let legacy: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name IN ('columns_legacy', 'items_legacy')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(legacy, 0);
    }
}
