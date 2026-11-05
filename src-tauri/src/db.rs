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
