use crate::db::{
    code_exists, new_id, next_sort_order, now_iso, validate_column_code, with_db_mut, DbState,
};
use crate::error::{AppError, AppResult};
use crate::models::{Column, CreateColumnInput, UpdateColumnInput};
use rusqlite::{params, OptionalExtension};
use tauri::State;

fn map_column(conn: &rusqlite::Connection, id: &str) -> AppResult<Column> {
    Ok(conn.query_row(
        "SELECT id, name, code, sort_order, deleted_at, created_at, updated_at
         FROM columns WHERE id = ?1 AND deleted_at IS NULL",
        [id],
        |row| {
            Ok(Column {
                id: row.get(0)?,
                name: row.get(1)?,
                code: row.get(2)?,
                sort_order: row.get(3)?,
                deleted_at: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
                items: Vec::new(),
            })
        },
    )?)
}

#[tauri::command]
pub fn create_column(state: State<'_, DbState>, input: CreateColumnInput) -> AppResult<Column> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::msg("Tên cột không được để trống"));
    }
    let code = validate_column_code(&input.code)?;

    with_db_mut(&state, |conn| {
        if code_exists(conn, &code, None)? {
            return Err(AppError::msg(format!("Code '{code}' đã tồn tại")));
        }

        let now = now_iso();
        let id = new_id();
        let sort_order = next_sort_order(conn, "columns", "deleted_at IS NULL", &[])?;

        conn.execute(
            "INSERT INTO columns (id, name, code, sort_order, deleted_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, NULL, ?5, ?5)",
            params![id, name, code, sort_order, now],
        )?;

        map_column(conn, &id)
    })
}

#[tauri::command]
pub fn update_column(state: State<'_, DbState>, input: UpdateColumnInput) -> AppResult<Column> {
    with_db_mut(&state, |conn| {
        let existing: Option<(String, String)> = conn
            .query_row(
                "SELECT name, code FROM columns WHERE id = ?1 AND deleted_at IS NULL",
                [&input.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        let Some((cur_name, cur_code)) = existing else {
            return Err(AppError::msg("Không tìm thấy cột"));
        };

        let name = input
            .name
            .map(|n| n.trim().to_string())
            .unwrap_or(cur_name);
        if name.is_empty() {
            return Err(AppError::msg("Tên cột không được để trống"));
        }
        let code = if let Some(c) = input.code {
            let code = validate_column_code(&c)?;
            if code_exists(conn, &code, Some(&input.id))? {
                return Err(AppError::msg(format!("Code '{code}' đã tồn tại")));
            }
            code
        } else {
            cur_code
        };

        let now = now_iso();
        conn.execute(
            "UPDATE columns SET name = ?1, code = ?2, updated_at = ?3 WHERE id = ?4",
            params![name, code, now, input.id],
        )?;
        map_column(conn, &input.id)
    })
}

#[tauri::command]
pub fn soft_delete_column(state: State<'_, DbState>, id: String) -> AppResult<()> {
    with_db_mut(&state, |conn| {
        let tx = conn.transaction()?;
        let now = now_iso();
        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM columns WHERE id = ?1 AND deleted_at IS NULL)",
            [&id],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(AppError::msg("Không tìm thấy cột"));
        }
        // Soft-delete mọi item thuộc cột global (mọi đầu mục)
        tx.execute(
            "UPDATE items SET deleted_at = ?1, updated_at = ?1 WHERE column_id = ?2 AND deleted_at IS NULL",
            params![now, id],
        )?;
        tx.execute(
            "UPDATE columns SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        tx.commit()?;
        Ok(())
    })
}
