use crate::db::{now_iso, with_db_mut, DbState};
use crate::error::{AppError, AppResult};
use crate::models::{ReorderInput, ReorderItemsInput};
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn reorder_categories(state: State<'_, DbState>, input: ReorderInput) -> AppResult<()> {
    with_db_mut(&state, |conn| {
        let tx = conn.transaction()?;
        let now = now_iso();
        for (i, id) in input.ids.iter().enumerate() {
            let changed = tx.execute(
                "UPDATE categories SET sort_order = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL",
                params![i as i64, now, id],
            )?;
            if changed == 0 {
                return Err(AppError::msg(format!("Không tìm thấy đầu mục {id}")));
            }
        }
        tx.commit()?;
        Ok(())
    })
}

#[tauri::command]
pub fn reorder_columns(state: State<'_, DbState>, input: ReorderInput) -> AppResult<()> {
    with_db_mut(&state, |conn| {
        let tx = conn.transaction()?;
        let now = now_iso();
        for (i, id) in input.ids.iter().enumerate() {
            let changed = tx.execute(
                "UPDATE columns SET sort_order = ?1, updated_at = ?2 WHERE id = ?3 AND deleted_at IS NULL",
                params![i as i64, now, id],
            )?;
            if changed == 0 {
                return Err(AppError::msg(format!("Không tìm thấy cột {id}")));
            }
        }
        tx.commit()?;
        Ok(())
    })
}

#[tauri::command]
pub fn reorder_items(state: State<'_, DbState>, input: ReorderItemsInput) -> AppResult<()> {
    with_db_mut(&state, |conn| {
        let tx = conn.transaction()?;
        let now = now_iso();
        for (i, id) in input.ids.iter().enumerate() {
            let changed = tx.execute(
                "UPDATE items SET sort_order = ?1, updated_at = ?2
                 WHERE id = ?3 AND category_id = ?4 AND column_id = ?5 AND deleted_at IS NULL",
                params![i as i64, now, id, input.category_id, input.column_id],
            )?;
            if changed == 0 {
                return Err(AppError::msg(format!("Không tìm thấy item {id}")));
            }
        }
        tx.commit()?;
        Ok(())
    })
}
