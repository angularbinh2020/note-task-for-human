use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    #[serde(default)]
    pub category_id: String,
    #[serde(default)]
    pub column_id: String,
    pub name: String,
    pub description: String,
    pub sort_order: i64,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub id: String,
    pub name: String,
    pub code: String,
    pub sort_order: i64,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    /// Items thuộc đầu mục đang xem (không lưu trong bảng columns).
    #[serde(default)]
    pub items: Vec<Item>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub description: String,
    pub sort_order: i64,
    pub collapsed: bool,
    pub deleted_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    /// Snapshot cột global + items của đầu mục này.
    #[serde(default)]
    pub columns: Vec<Column>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPayload {
    pub version: i32,
    pub exported_at: String,
    #[serde(default)]
    pub columns: Vec<Column>,
    pub categories: Vec<Category>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryInput {
    pub name: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryInput {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub collapsed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateColumnInput {
    pub name: String,
    pub code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateColumnInput {
    pub id: String,
    pub name: Option<String>,
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateItemInput {
    pub category_id: String,
    pub column_id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateItemInput {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveItemInput {
    pub id: String,
    pub target_column_id: String,
    pub target_index: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderInput {
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderItemsInput {
    pub category_id: String,
    pub column_id: String,
    pub ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreInput {
    pub entity_type: String,
    pub id: String,
    #[serde(default)]
    pub with_children: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PurgeInput {
    pub entity_type: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportInput {
    #[serde(default = "default_true")]
    pub include_trash: bool,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrashItem {
    pub entity_type: String,
    pub id: String,
    pub name: String,
    pub detail: String,
    pub deleted_at: String,
    pub days_remaining: i64,
    pub parent_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreResult {
    pub restored_parents: Vec<String>,
    pub message: Option<String>,
}
