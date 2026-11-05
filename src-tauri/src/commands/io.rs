use crate::commands::category::{load_all_categories, load_global_columns};
use crate::db::{now_iso, with_db, with_db_mut, DbState};
use crate::error::{AppError, AppResult};
use crate::models::{Column, ExportInput, ExportPayload};
use rusqlite::params;
use std::collections::{HashMap, HashSet};
use tauri::State;

#[tauri::command]
pub fn export_json(state: State<'_, DbState>, input: ExportInput) -> AppResult<String> {
    with_db(&state, |conn| {
        let mut columns = load_global_columns(conn, input.include_trash)?;
        for col in &mut columns {
            col.items.clear();
        }
        let mut categories = load_all_categories(conn, input.include_trash)?;
        // Export: flatten items onto category (keep columns empty under category for v2 clarity)
        for cat in &mut categories {
            let mut flat_items = Vec::new();
            for col in &cat.columns {
                flat_items.extend(col.items.clone());
            }
            cat.columns = columns
                .iter()
                .cloned()
                .map(|mut c| {
                    c.items = flat_items
                        .iter()
                        .filter(|i| i.column_id == c.id)
                        .cloned()
                        .collect();
                    c
                })
                .collect();
        }
        let payload = ExportPayload {
            version: 2,
            exported_at: now_iso(),
            columns: columns
                .into_iter()
                .map(|mut c| {
                    c.items.clear();
                    c
                })
                .collect(),
            categories,
        };
        Ok(serde_json::to_string_pretty(&payload)?)
    })
}

fn validate_payload(payload: &ExportPayload) -> AppResult<()> {
    if payload.version != 1 && payload.version != 2 {
        return Err(AppError::msg(format!(
            "Version {} không được hỗ trợ (hỗ trợ version 1–2)",
            payload.version
        )));
    }

    let mut cat_ids = HashSet::new();
    let mut col_ids = HashSet::new();
    let mut item_ids = HashSet::new();
    let mut codes = HashSet::new();

    // Collect columns from top-level (v2) or nested (v1)
    let mut all_columns: Vec<&Column> = payload.columns.iter().collect();
    if all_columns.is_empty() {
        for cat in &payload.categories {
            for col in &cat.columns {
                all_columns.push(col);
            }
        }
    }

    for col in &all_columns {
        if col.name.trim().is_empty() || col.code.trim().is_empty() {
            return Err(AppError::msg("Column thiếu name/code"));
        }
        let code = col.code.trim().to_string();
        let re = regex::Regex::new(r"^[a-zA-Z0-9_-]+$").unwrap();
        if !re.is_match(&code) {
            return Err(AppError::msg(format!("Code không hợp lệ: {code}")));
        }
        if !codes.insert(code) {
            // v1 may repeat codes across categories — allow only unique after normalize for v2
            if payload.version == 2 {
                return Err(AppError::msg(format!(
                    "Trùng column code: {}",
                    col.code.trim()
                )));
            }
        }
        if !col_ids.insert(col.id.clone()) && payload.version == 2 {
            return Err(AppError::msg(format!("Trùng column id: {}", col.id)));
        }
    }

    for cat in &payload.categories {
        if cat.name.trim().is_empty() {
            return Err(AppError::msg("Category thiếu name"));
        }
        if !cat_ids.insert(cat.id.clone()) {
            return Err(AppError::msg(format!("Trùng category id: {}", cat.id)));
        }
        for col in &cat.columns {
            for item in &col.items {
                if item.name.trim().is_empty() {
                    return Err(AppError::msg("Item thiếu name"));
                }
                if !item_ids.insert(item.id.clone()) {
                    return Err(AppError::msg(format!("Trùng item id: {}", item.id)));
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn import_json(state: State<'_, DbState>, json: String) -> AppResult<()> {
    let payload: ExportPayload = serde_json::from_str(&json)
        .map_err(|e| AppError::msg(format!("JSON không hợp lệ: {e}")))?;
    validate_payload(&payload)?;

    with_db_mut(&state, |conn| {
        let tx = conn.transaction()?;
        tx.execute_batch(
            "DELETE FROM items;
             DELETE FROM columns;
             DELETE FROM categories;",
        )?;

        // Build global columns
        let mut inserted_codes: HashMap<String, String> = HashMap::new();

        if payload.version == 2 && !payload.columns.is_empty() {
            for col in &payload.columns {
                let code = col.code.trim().to_string();
                tx.execute(
                    "INSERT INTO columns (id, name, code, sort_order, deleted_at, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        col.id,
                        col.name.trim(),
                        code,
                        col.sort_order,
                        col.deleted_at,
                        col.created_at,
                        col.updated_at,
                    ],
                )?;
                inserted_codes.insert(col.code.trim().to_string(), col.id.clone());
            }
        } else {
            // v1: dedupe nested columns by code → global
            for cat in &payload.categories {
                for col in &cat.columns {
                    let code = col.code.trim().to_string();
                    let norm = if code.starts_with("running_") {
                        "running".to_string()
                    } else if code.starts_with("pending_") {
                        "pending".to_string()
                    } else {
                        code.clone()
                    };
                    if inserted_codes.contains_key(&norm) {
                        continue;
                    }
                    let name = if norm == "running" {
                        "Đang chạy".to_string()
                    } else if norm == "pending" {
                        "Chờ chạy".to_string()
                    } else {
                        col.name.trim().to_string()
                    };
                    tx.execute(
                        "INSERT INTO columns (id, name, code, sort_order, deleted_at, created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        params![
                            col.id,
                            name,
                            norm,
                            col.sort_order,
                            col.deleted_at,
                            col.created_at,
                            col.updated_at,
                        ],
                    )?;
                    inserted_codes.insert(norm, col.id.clone());
                    inserted_codes.insert(code, col.id.clone());
                }
            }
        }

        // Map helper for v1 codes
        let resolve_column_id = |col: &Column| -> String {
            let code = col.code.trim().to_string();
            let norm = if code.starts_with("running_") {
                "running".to_string()
            } else if code.starts_with("pending_") {
                "pending".to_string()
            } else {
                code.clone()
            };
            inserted_codes
                .get(&norm)
                .or_else(|| inserted_codes.get(&code))
                .cloned()
                .unwrap_or_else(|| col.id.clone())
        };

        for cat in &payload.categories {
            tx.execute(
                "INSERT INTO categories (id, name, description, sort_order, collapsed, deleted_at, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    cat.id,
                    cat.name.trim(),
                    cat.description,
                    cat.sort_order,
                    if cat.collapsed { 1 } else { 0 },
                    cat.deleted_at,
                    cat.created_at,
                    cat.updated_at,
                ],
            )?;

            for col in &cat.columns {
                let column_id = if payload.version == 2 {
                    col.id.clone()
                } else {
                    resolve_column_id(col)
                };
                for item in &col.items {
                    let item_column_id = if item.column_id.is_empty() {
                        column_id.clone()
                    } else if payload.version == 2 {
                        item.column_id.clone()
                    } else {
                        column_id.clone()
                    };
                    let category_id = if item.category_id.is_empty() {
                        cat.id.clone()
                    } else {
                        item.category_id.clone()
                    };
                    tx.execute(
                        "INSERT INTO items (id, category_id, column_id, name, description, sort_order, deleted_at, created_at, updated_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                        params![
                            item.id,
                            category_id,
                            item_column_id,
                            item.name.trim(),
                            item.description,
                            item.sort_order,
                            item.deleted_at,
                            item.created_at,
                            item.updated_at,
                        ],
                    )?;
                }
            }
        }

        tx.commit()?;
        Ok(())
    })
}

#[tauri::command]
pub fn get_db_path(app: tauri::AppHandle) -> AppResult<String> {
    Ok(crate::db::db_path(&app)?.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Category, Item};

    const TS: &str = "2026-01-01T00:00:00.000Z";

    fn item(id: &str, name: &str) -> Item {
        Item {
            id: id.into(),
            category_id: "cat-1".into(),
            column_id: "col-1".into(),
            name: name.into(),
            description: String::new(),
            sort_order: 0,
            deleted_at: None,
            created_at: TS.into(),
            updated_at: TS.into(),
        }
    }

    fn column(id: &str, code: &str) -> Column {
        Column {
            id: id.into(),
            name: format!("Cột {id}"),
            code: code.into(),
            sort_order: 0,
            deleted_at: None,
            created_at: TS.into(),
            updated_at: TS.into(),
            items: Vec::new(),
        }
    }

    fn category(id: &str, name: &str) -> Category {
        Category {
            id: id.into(),
            name: name.into(),
            description: String::new(),
            sort_order: 0,
            collapsed: false,
            deleted_at: None,
            created_at: TS.into(),
            updated_at: TS.into(),
            columns: Vec::new(),
        }
    }

    fn payload(version: i32, columns: Vec<Column>, categories: Vec<Category>) -> ExportPayload {
        ExportPayload {
            version,
            exported_at: TS.into(),
            columns,
            categories,
        }
    }

    #[test]
    fn valid_v2_payload_passes() {
        let mut col = column("col-1", "running");
        col.items.push(item("item-1", "Việc A"));
        let mut cat = category("cat-1", "Đầu mục A");
        cat.columns.push(col.clone());
        let p = payload(2, vec![col], vec![cat]);
        validate_payload(&p).unwrap();
    }

    #[test]
    fn unsupported_version_is_rejected() {
        let p = payload(3, vec![column("col-1", "running")], vec![]);
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("không được hỗ trợ"));
    }

    #[test]
    fn v1_and_v2_are_supported() {
        let p = payload(1, vec![], vec![category("cat-1", "Đầu mục")]);
        validate_payload(&p).unwrap();
        let p = payload(2, vec![], vec![category("cat-1", "Đầu mục")]);
        validate_payload(&p).unwrap();
    }

    #[test]
    fn v2_duplicate_code_is_rejected() {
        let p = payload(
            2,
            vec![column("col-1", "running"), column("col-2", "running")],
            vec![],
        );
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("Trùng column code"));
    }

    #[test]
    fn v1_duplicate_codes_are_allowed() {
        // v1: mỗi đầu mục có bộ cột riêng → code lặp là hợp lệ
        let mut cat1 = category("cat-1", "Đầu mục A");
        cat1.columns.push(column("col-1", "running"));
        let mut cat2 = category("cat-2", "Đầu mục B");
        cat2.columns.push(column("col-2", "running"));
        let p = payload(1, vec![], vec![cat1, cat2]);
        validate_payload(&p).unwrap();
    }

    #[test]
    fn v2_duplicate_column_id_is_rejected() {
        let p = payload(
            2,
            vec![column("col-1", "running"), column("col-1", "pending")],
            vec![],
        );
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("Trùng column id"));
    }

    #[test]
    fn column_without_name_or_code_is_rejected() {
        let p = payload(2, vec![column("col-1", "")], vec![]);
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("Column thiếu name/code"));

        let mut bad = column("col-1", "running");
        bad.name = "  ".into();
        let p = payload(2, vec![bad], vec![]);
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("Column thiếu name/code"));
    }

    #[test]
    fn invalid_code_charset_is_rejected() {
        let p = payload(2, vec![column("col-1", "code không hợp lệ!")], vec![]);
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("Code không hợp lệ"));
    }

    #[test]
    fn category_without_name_is_rejected() {
        let p = payload(2, vec![], vec![category("cat-1", "   ")]);
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("Category thiếu name"));
    }

    #[test]
    fn duplicate_category_id_is_rejected() {
        let p = payload(
            2,
            vec![],
            vec![category("cat-1", "A"), category("cat-1", "B")],
        );
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("Trùng category id"));
    }

    #[test]
    fn item_without_name_is_rejected() {
        let mut cat = category("cat-1", "Đầu mục A");
        let mut col = column("col-1", "running");
        col.items.push(item("item-1", "  "));
        cat.columns.push(col);
        let p = payload(2, vec![], vec![cat]);
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("Item thiếu name"));
    }

    #[test]
    fn duplicate_item_id_is_rejected() {
        let mut cat = category("cat-1", "Đầu mục A");
        let mut col1 = column("col-1", "running");
        col1.items.push(item("item-1", "A"));
        let mut col2 = column("col-2", "pending");
        col2.items.push(item("item-1", "B"));
        cat.columns.push(col1);
        cat.columns.push(col2);
        let p = payload(2, vec![], vec![cat]);
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("Trùng item id"));
    }

    #[test]
    fn duplicate_item_id_across_categories_is_rejected() {
        let mut cat1 = category("cat-1", "Đầu mục A");
        let mut col1 = column("col-1", "running");
        col1.items.push(item("item-1", "A"));
        cat1.columns.push(col1);
        let mut cat2 = category("cat-2", "Đầu mục B");
        let mut col2 = column("col-1", "running");
        col2.items.push(item("item-1", "B"));
        cat2.columns.push(col2);
        let p = payload(1, vec![], vec![cat1, cat2]);
        let err = validate_payload(&p).unwrap_err();
        assert!(err.to_string().contains("Trùng item id"));
    }
}
