use crate::db::{new_id, next_sort_order, now_iso, with_db, with_db_mut, DbState};
use crate::error::{AppError, AppResult};
use crate::models::{Category, Column, CreateCategoryInput, Item, UpdateCategoryInput};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

fn map_item(row: &rusqlite::Row<'_>) -> rusqlite::Result<Item> {
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
}

fn map_column(row: &rusqlite::Row<'_>) -> rusqlite::Result<Column> {
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
}

fn map_category(row: &rusqlite::Row<'_>) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        sort_order: row.get(3)?,
        collapsed: row.get::<_, i64>(4)? != 0,
        deleted_at: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
        columns: Vec::new(),
    })
}

pub fn load_global_columns(conn: &Connection, include_trash: bool) -> AppResult<Vec<Column>> {
    let sql = if include_trash {
        "SELECT id, name, code, sort_order, deleted_at, created_at, updated_at
         FROM columns ORDER BY sort_order ASC"
    } else {
        "SELECT id, name, code, sort_order, deleted_at, created_at, updated_at
         FROM columns WHERE deleted_at IS NULL ORDER BY sort_order ASC"
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt
        .query_map([], map_column)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

fn attach_columns_for_category(
    conn: &Connection,
    category: &mut Category,
    global_columns: &[Column],
    include_trash_items: bool,
) -> AppResult<()> {
    let mut columns = global_columns.to_vec();
    for column in &mut columns {
        let mut stmt = if include_trash_items {
            conn.prepare(
                "SELECT id, category_id, column_id, name, description, sort_order, deleted_at, created_at, updated_at
                 FROM items WHERE category_id = ?1 AND column_id = ?2 ORDER BY sort_order ASC",
            )?
        } else {
            conn.prepare(
                "SELECT id, category_id, column_id, name, description, sort_order, deleted_at, created_at, updated_at
                 FROM items WHERE category_id = ?1 AND column_id = ?2 AND deleted_at IS NULL
                 ORDER BY sort_order ASC",
            )?
        };
        column.items = stmt
            .query_map(params![category.id, column.id], map_item)?
            .collect::<Result<Vec<_>, _>>()?;
    }
    category.columns = columns;
    Ok(())
}

pub fn load_active_categories(conn: &Connection) -> AppResult<Vec<Category>> {
    let global_columns = load_global_columns(conn, false)?;
    let mut stmt = conn.prepare(
        "SELECT id, name, description, sort_order, collapsed, deleted_at, created_at, updated_at
         FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC",
    )?;
    let mut categories = stmt
        .query_map([], map_category)?
        .collect::<Result<Vec<_>, _>>()?;

    for category in &mut categories {
        attach_columns_for_category(conn, category, &global_columns, false)?;
    }
    Ok(categories)
}

pub fn load_all_categories(conn: &Connection, include_trash: bool) -> AppResult<Vec<Category>> {
    let global_columns = load_global_columns(conn, include_trash)?;
    let sql = if include_trash {
        "SELECT id, name, description, sort_order, collapsed, deleted_at, created_at, updated_at
         FROM categories ORDER BY sort_order ASC"
    } else {
        "SELECT id, name, description, sort_order, collapsed, deleted_at, created_at, updated_at
         FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC"
    };
    let mut stmt = conn.prepare(sql)?;
    let mut categories = stmt
        .query_map([], map_category)?
        .collect::<Result<Vec<_>, _>>()?;

    for category in &mut categories {
        attach_columns_for_category(conn, category, &global_columns, include_trash)?;
    }
    Ok(categories)
}

fn find_category(conn: &Connection, id: &str) -> AppResult<Category> {
    load_active_categories(conn)?
        .into_iter()
        .find(|c| c.id == id)
        .ok_or_else(|| AppError::msg("Không tìm thấy đầu mục"))
}

#[tauri::command]
pub fn list_categories(state: State<'_, DbState>) -> AppResult<Vec<Category>> {
    with_db(&state, load_active_categories)
}

#[tauri::command]
pub fn create_category(
    state: State<'_, DbState>,
    input: CreateCategoryInput,
) -> AppResult<Category> {
    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::msg("Tên đầu mục không được để trống"));
    }
    let description = input.description.trim().to_string();

    with_db_mut(&state, |conn| {
        let now = now_iso();
        let id = new_id();
        let sort_order =
            next_sort_order(conn, "categories", "1=1", &[])?;

        conn.execute(
            "INSERT INTO categories (id, name, description, sort_order, collapsed, deleted_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, 0, NULL, ?5, ?5)",
            params![id, name, description, sort_order, now],
        )?;

        find_category(conn, &id)
    })
}

#[tauri::command]
pub fn update_category(
    state: State<'_, DbState>,
    input: UpdateCategoryInput,
) -> AppResult<Category> {
    with_db_mut(&state, |conn| {
        let existing: Option<(String, String, i64)> = conn
            .query_row(
                "SELECT name, description, collapsed FROM categories WHERE id = ?1 AND deleted_at IS NULL",
                [&input.id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .optional()?;

        let Some((cur_name, cur_desc, cur_collapsed)) = existing else {
            return Err(AppError::msg("Không tìm thấy đầu mục"));
        };

        let name = input
            .name
            .map(|n| n.trim().to_string())
            .unwrap_or(cur_name);
        if name.is_empty() {
            return Err(AppError::msg("Tên đầu mục không được để trống"));
        }
        let description = input
            .description
            .map(|d| d.trim().to_string())
            .unwrap_or(cur_desc);
        let collapsed = input
            .collapsed
            .map(|b| if b { 1 } else { 0 })
            .unwrap_or(cur_collapsed);
        let now = now_iso();

        conn.execute(
            "UPDATE categories SET name = ?1, description = ?2, collapsed = ?3, updated_at = ?4 WHERE id = ?5",
            params![name, description, collapsed, now, input.id],
        )?;

        find_category(conn, &input.id)
    })
}

#[tauri::command]
pub fn soft_delete_category(state: State<'_, DbState>, id: String) -> AppResult<()> {
    with_db_mut(&state, |conn| {
        let tx = conn.transaction()?;
        let now = now_iso();

        let exists: bool = tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?1 AND deleted_at IS NULL)",
            [&id],
            |r| r.get(0),
        )?;
        if !exists {
            return Err(AppError::msg("Không tìm thấy đầu mục"));
        }

        // Chỉ soft-delete items của đầu mục — cột là global, giữ nguyên
        tx.execute(
            "UPDATE items SET deleted_at = ?1, updated_at = ?1
             WHERE category_id = ?2 AND deleted_at IS NULL",
            params![now, id],
        )?;
        tx.execute(
            "UPDATE categories SET deleted_at = ?1, updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )?;
        tx.commit()?;
        Ok(())
    })
}
