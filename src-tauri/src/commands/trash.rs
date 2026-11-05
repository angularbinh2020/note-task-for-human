use crate::db::{now_iso, with_db, with_db_mut, DbState};
use crate::error::{AppError, AppResult};
use crate::models::{PurgeInput, RestoreInput, RestoreResult, TrashItem};
use chrono::{Duration, Utc};
use rusqlite::{params, OptionalExtension};
use tauri::State;

fn days_remaining(deleted_at: &str) -> i64 {
    let Ok(dt) = chrono::DateTime::parse_from_rfc3339(deleted_at) else {
        return 0;
    };
    let purge_at = dt.with_timezone(&Utc) + Duration::days(30);
    let remaining = purge_at.signed_duration_since(Utc::now()).num_days();
    remaining.max(0)
}

#[tauri::command]
pub fn list_trash(state: State<'_, DbState>) -> AppResult<Vec<TrashItem>> {
    with_db(&state, |conn| {
        let mut items = Vec::new();

        let mut cat_stmt = conn.prepare(
            "SELECT id, name, description, deleted_at FROM categories WHERE deleted_at IS NOT NULL
             ORDER BY deleted_at DESC",
        )?;
        for row in cat_stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })? {
            let (id, name, description, deleted_at) = row?;
            items.push(TrashItem {
                entity_type: "category".into(),
                id,
                name,
                detail: description,
                days_remaining: days_remaining(&deleted_at),
                deleted_at,
                parent_hint: None,
            });
        }

        let mut col_stmt = conn.prepare(
            "SELECT id, name, code, deleted_at FROM columns WHERE deleted_at IS NOT NULL
             ORDER BY deleted_at DESC",
        )?;
        for row in col_stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
            ))
        })? {
            let (id, name, code, deleted_at) = row?;
            items.push(TrashItem {
                entity_type: "column".into(),
                id,
                name,
                detail: code,
                days_remaining: days_remaining(&deleted_at),
                deleted_at,
                parent_hint: Some("Cột global".into()),
            });
        }

        let mut item_stmt = conn.prepare(
            "SELECT i.id, i.name, i.description, i.deleted_at, col.name, cat.name
             FROM items i
             JOIN columns col ON col.id = i.column_id
             JOIN categories cat ON cat.id = i.category_id
             WHERE i.deleted_at IS NOT NULL
             ORDER BY i.deleted_at DESC",
        )?;
        for row in item_stmt.query_map([], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, String>(4)?,
                r.get::<_, String>(5)?,
            ))
        })? {
            let (id, name, description, deleted_at, col_name, cat_name) = row?;
            items.push(TrashItem {
                entity_type: "item".into(),
                id,
                name,
                detail: description,
                days_remaining: days_remaining(&deleted_at),
                deleted_at,
                parent_hint: Some(format!("{cat_name} / {col_name}")),
            });
        }

        items.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
        Ok(items)
    })
}

#[tauri::command]
pub fn restore_entity(state: State<'_, DbState>, input: RestoreInput) -> AppResult<RestoreResult> {
    with_db_mut(&state, |conn| {
        let tx = conn.transaction()?;
        let now = now_iso();
        let mut restored_parents = Vec::new();
        let mut message = None;

        match input.entity_type.as_str() {
            "category" => {
                let changed = tx.execute(
                    "UPDATE categories SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NOT NULL",
                    params![now, input.id],
                )?;
                if changed == 0 {
                    return Err(AppError::msg("Không tìm thấy đầu mục trong thùng rác"));
                }
                if input.with_children {
                    tx.execute(
                        "UPDATE items SET deleted_at = NULL, updated_at = ?1
                         WHERE category_id = ?2 AND deleted_at IS NOT NULL",
                        params![now, input.id],
                    )?;
                }
            }
            "column" => {
                let changed = tx.execute(
                    "UPDATE columns SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2 AND deleted_at IS NOT NULL",
                    params![now, input.id],
                )?;
                if changed == 0 {
                    return Err(AppError::msg("Không tìm thấy cột trong thùng rác"));
                }
                if input.with_children {
                    tx.execute(
                        "UPDATE items SET deleted_at = NULL, updated_at = ?1 WHERE column_id = ?2 AND deleted_at IS NOT NULL",
                        params![now, input.id],
                    )?;
                }
            }
            "item" => {
                let (column_id, category_id): (String, String) = tx
                    .query_row(
                        "SELECT column_id, category_id FROM items WHERE id = ?1 AND deleted_at IS NOT NULL",
                        [&input.id],
                        |r| Ok((r.get(0)?, r.get(1)?)),
                    )
                    .optional()?
                    .ok_or_else(|| AppError::msg("Không tìm thấy item trong thùng rác"))?;

                let col_deleted: Option<String> = tx
                    .query_row(
                        "SELECT deleted_at FROM columns WHERE id = ?1",
                        [&column_id],
                        |r| r.get(0),
                    )
                    .optional()?
                    .flatten();
                let cat_deleted: Option<String> = tx
                    .query_row(
                        "SELECT deleted_at FROM categories WHERE id = ?1",
                        [&category_id],
                        |r| r.get(0),
                    )
                    .optional()?
                    .flatten();

                if cat_deleted.is_some() {
                    tx.execute(
                        "UPDATE categories SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
                        params![now, category_id],
                    )?;
                    restored_parents.push("đầu mục".into());
                }
                if col_deleted.is_some() {
                    tx.execute(
                        "UPDATE columns SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
                        params![now, column_id],
                    )?;
                    restored_parents.push("cột".into());
                }
                if !restored_parents.is_empty() {
                    message = Some(format!(
                        "Đã khôi phục kèm chuỗi cha: {}.",
                        restored_parents.join(", ")
                    ));
                }

                tx.execute(
                    "UPDATE items SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2",
                    params![now, input.id],
                )?;
            }
            _ => return Err(AppError::msg("Loại entity không hợp lệ")),
        }

        tx.commit()?;
        Ok(RestoreResult {
            restored_parents,
            message,
        })
    })
}

fn hard_delete_category(tx: &rusqlite::Transaction<'_>, id: &str) -> AppResult<()> {
    tx.execute("DELETE FROM items WHERE category_id = ?1", [id])?;
    tx.execute("DELETE FROM categories WHERE id = ?1", [id])?;
    Ok(())
}

fn hard_delete_column(tx: &rusqlite::Transaction<'_>, id: &str) -> AppResult<()> {
    tx.execute("DELETE FROM items WHERE column_id = ?1", [id])?;
    tx.execute("DELETE FROM columns WHERE id = ?1", [id])?;
    Ok(())
}

#[tauri::command]
pub fn purge_entity(state: State<'_, DbState>, input: PurgeInput) -> AppResult<()> {
    with_db_mut(&state, |conn| {
        let tx = conn.transaction()?;
        match input.entity_type.as_str() {
            "category" => {
                let ok: bool = tx.query_row(
                    "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?1 AND deleted_at IS NOT NULL)",
                    [&input.id],
                    |r| r.get(0),
                )?;
                if !ok {
                    return Err(AppError::msg("Không tìm thấy đầu mục trong thùng rác"));
                }
                hard_delete_category(&tx, &input.id)?;
            }
            "column" => {
                let ok: bool = tx.query_row(
                    "SELECT EXISTS(SELECT 1 FROM columns WHERE id = ?1 AND deleted_at IS NOT NULL)",
                    [&input.id],
                    |r| r.get(0),
                )?;
                if !ok {
                    return Err(AppError::msg("Không tìm thấy cột trong thùng rác"));
                }
                hard_delete_column(&tx, &input.id)?;
            }
            "item" => {
                let changed = tx.execute(
                    "DELETE FROM items WHERE id = ?1 AND deleted_at IS NOT NULL",
                    [&input.id],
                )?;
                if changed == 0 {
                    return Err(AppError::msg("Không tìm thấy item trong thùng rác"));
                }
            }
            _ => return Err(AppError::msg("Loại entity không hợp lệ")),
        }
        tx.commit()?;
        Ok(())
    })
}

#[tauri::command]
pub fn purge_expired(state: State<'_, DbState>) -> AppResult<u64> {
    with_db_mut(&state, |conn| {
        let cutoff = (Utc::now() - Duration::days(30))
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
        let tx = conn.transaction()?;

        let item_count = tx.execute(
            "DELETE FROM items WHERE deleted_at IS NOT NULL AND deleted_at <= ?1",
            [&cutoff],
        )?;
        let col_count = tx.execute(
            "DELETE FROM columns WHERE deleted_at IS NOT NULL AND deleted_at <= ?1",
            [&cutoff],
        )?;
        let cat_count = tx.execute(
            "DELETE FROM categories WHERE deleted_at IS NOT NULL AND deleted_at <= ?1",
            [&cutoff],
        )?;
        tx.commit()?;
        Ok((item_count + col_count + cat_count) as u64)
    })
}

#[tauri::command]
pub fn purge_all_trash(state: State<'_, DbState>) -> AppResult<u64> {
    with_db_mut(&state, |conn| {
        let tx = conn.transaction()?;
        let item_count = tx.execute("DELETE FROM items WHERE deleted_at IS NOT NULL", [])?;
        let col_count = tx.execute("DELETE FROM columns WHERE deleted_at IS NOT NULL", [])?;
        let cat_count = tx.execute("DELETE FROM categories WHERE deleted_at IS NOT NULL", [])?;
        tx.commit()?;
        Ok((item_count + col_count + cat_count) as u64)
    })
}

#[tauri::command]
pub fn run_startup_maintenance(state: State<'_, DbState>) -> AppResult<u64> {
    purge_expired(state)
}

#[tauri::command]
pub fn trash_count(state: State<'_, DbState>) -> AppResult<u64> {
    with_db(&state, |conn| {
        let cats: u64 = conn.query_row(
            "SELECT COUNT(*) FROM categories WHERE deleted_at IS NOT NULL",
            [],
            |r| r.get(0),
        )?;
        let cols: u64 = conn.query_row(
            "SELECT COUNT(*) FROM columns WHERE deleted_at IS NOT NULL",
            [],
            |r| r.get(0),
        )?;
        let items: u64 = conn.query_row(
            "SELECT COUNT(*) FROM items WHERE deleted_at IS NOT NULL",
            [],
            |r| r.get(0),
        )?;
        Ok(cats + cols + items)
    })
}
