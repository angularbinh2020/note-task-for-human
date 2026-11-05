mod commands;
mod db;
mod error;
mod models;

use db::{migrate, open_connection, DbState};
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let path = db::db_path(app.handle())?;
            let mut conn = open_connection(&path)?;
            migrate(&mut conn)?;
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::category::list_categories,
            commands::category::create_category,
            commands::category::update_category,
            commands::category::soft_delete_category,
            commands::column::create_column,
            commands::column::update_column,
            commands::column::soft_delete_column,
            commands::item::create_item,
            commands::item::update_item,
            commands::item::soft_delete_item,
            commands::item::move_item,
            commands::reorder::reorder_categories,
            commands::reorder::reorder_columns,
            commands::reorder::reorder_items,
            commands::trash::list_trash,
            commands::trash::restore_entity,
            commands::trash::purge_entity,
            commands::trash::purge_expired,
            commands::trash::purge_all_trash,
            commands::trash::run_startup_maintenance,
            commands::trash::trash_count,
            commands::io::export_json,
            commands::io::import_json,
            commands::io::get_db_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
