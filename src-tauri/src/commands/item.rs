use crate::db::{new_id, next_sort_order, now_iso, with_db_mut, DbState};
use crate::error::{AppError, AppResult};
use crate::models::{CreateItemInput, Item, MoveItemInput, UpdateItemInput};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

fn map_item(conn: &Connection, id: &str) -> AppResult<Item> {
    Ok(conn.query_row(
        "SELECT id, category_id, column_id, name, description, sort_order, deleted_at, created_at, updated_at
         FROM items WHERE id = ?1 AND deleted_at IS NULL",
        [id],
        |row| {
            Ok(Item {
                id: row.get(0)?,
                category_id: row.get(1)?,
                column_id: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                sort_order: row.get(5)?,
                deleted_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )?)
}

#[tauri::command]
pub fn create_item(state: State<'_, DbState>, input: CreateItemInput) -> AppResult<Item> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::msg("Tên item không được để trống"));
    }
    let description = input.description.trim().to_string();

    with_db_mut(&state, |conn| {
        let cat_ok: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?1 AND deleted_at IS NULL)",
            [&input.category_id],
            |r| r.get(0),
        )?;
        if !cat_ok {
            return Err(AppError::msg("Không tìm thấy đầu mục"));
        }
        let col_ok: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM columns WHERE id = ?1 AND deleted_at IS NULL)",
            [&input.column_id],
            |r| r.get(0),
        )?;
        if !col_ok {
            return Err(AppError::msg("Không tìm thấy cột"));
        }

        let now = now_iso();
        let id = new_id();
        let sort_order = next_sort_order(
            conn,
            "items",
            "category_id = ?1 AND column_id = ?2 AND deleted_at IS NULL",
            &[&input.category_id, &input.column_id],
        )?;

        conn.execute(
            "INSERT INTO items (id, category_id, column_id, name, description, sort_order, deleted_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7, ?7)",
            params![
                id,
                input.category_id,
                input.column_id,
                name,
                description,
                sort_order,
                now
            ],
        )?;
        map_item(conn, &id)
    })
}

#[tauri::command]
pub fn update_item(state: State<'_, DbState>, input: UpdateItemInput) -> AppResult<Item> {
    with_db_mut(&state, |conn| {
        let existing: Option<(String, String)> = conn
            .query_row(
                "SELECT name, description FROM items WHERE id = ?1 AND deleted_at IS NULL",
                [&input.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        let Some((cur_name, cur_desc)) = existing else {
            return Err(AppError::msg("Không tìm thấy item"));
        };

        let name = input
            .name
            .map(|n| n.trim().to_string())
            .unwrap_or(cur_name);
        if name.is_empty() {
            return Err(AppError::msg("Tên item không được để trống"));
        }
        let description = input
            .description
            .map(|d| d.trim().to_string())
            .unwrap_or(cur_desc);
        let now = now_iso();

        conn.execute(
            "UPDATE items SET name = ?1, description = ?2, updated_at = ?3 WHERE id = ?4",
            params![name, description, now, input.id],
        )?;
        map_item(conn, &input.id)
    })
}

#[tauri::command]
pub fn soft_delete_item(state: State<'_, DbState>, id: String) -> AppResult<()> {
    with_db_mut(&state, |conn| {
        let now = now_iso();
        let changed = conn.execute(
            "UPDATE items SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NULL",
            params![now, id],
        )?;
        if changed == 0 {
            return Err(AppError::msg("Không tìm thấy item"));
        }
        Ok(())
    })
}

#[tauri::command]
pub fn move_item(state: State<'_, DbState>, input: MoveItemInput) -> AppResult<Item> {
    with_db_mut(&state, |conn| {
        let tx = conn.transaction()?;

        let (current_column_id, category_id): (String, String) = tx
            .query_row(
                "SELECT column_id, category_id FROM items WHERE id = ?1 AND deleted_at IS NULL",
                [&input.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?
            .ok_or_else(|| AppError::msg("Không tìm thấy item"))?;

        let col_ok: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM columns WHERE id = ?1 AND deleted_at IS NULL)",
            [&input.target_column_id],
            |r| r.get(0),
        )?;
        if !col_ok {
            return Err(AppError::msg("Không tìm thấy cột đích"));
        }

        let mut ids: Vec<String> = tx
            .prepare(
                "SELECT id FROM items
                 WHERE category_id = ?1 AND column_id = ?2 AND deleted_at IS NULL AND id != ?3
                 ORDER BY sort_order ASC",
            )?
            .query_map(
                params![category_id, input.target_column_id, input.id],
                |r| r.get(0),
            )?
            .collect::<Result<Vec<_>, _>>()?;

        let idx = input.target_index.clamp(0, ids.len() as i64) as usize;
        ids.insert(idx, input.id.clone());

        let now = now_iso();
        tx.execute(
            "UPDATE items SET column_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![input.target_column_id, now, input.id],
        )?;

        if current_column_id != input.target_column_id {
            let source_ids: Vec<String> = tx
                .prepare(
                    "SELECT id FROM items
                     WHERE category_id = ?1 AND column_id = ?2 AND deleted_at IS NULL
                     ORDER BY sort_order ASC",
                )?
                .query_map(params![category_id, current_column_id], |r| r.get(0))?
                .collect::<Result<Vec<_>, _>>()?;
            for (i, sid) in source_ids.iter().enumerate() {
                tx.execute(
                    "UPDATE items SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
                    params![i as i64, now, sid],
                )?;
            }
        }

        for (i, iid) in ids.iter().enumerate() {
            tx.execute(
                "UPDATE items SET sort_order = ?1, updated_at = ?2 WHERE id = ?3",
                params![i as i64, now, iid],
            )?;
        }

        tx.commit()?;
        map_item(conn, &input.id)
    })
}
