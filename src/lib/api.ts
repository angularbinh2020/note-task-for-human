import { invoke } from "@tauri-apps/api/core";
import type { Category, Column, Item, RestoreResult, TrashItem } from "./types";

export const api = {
  listCategories: () => invoke<Category[]>("list_categories"),
  createCategory: (name: string, description = "") =>
    invoke<Category>("create_category", { input: { name, description } }),
  updateCategory: (input: {
    id: string;
    name?: string;
    description?: string;
    collapsed?: boolean;
  }) => invoke<Category>("update_category", { input }),
  softDeleteCategory: (id: string) => invoke<void>("soft_delete_category", { id }),
  reorderCategories: (ids: string[]) =>
    invoke<void>("reorder_categories", { input: { ids } }),

  createColumn: (name: string, code: string) =>
    invoke<Column>("create_column", { input: { name, code } }),
  updateColumn: (input: { id: string; name?: string; code?: string }) =>
    invoke<Column>("update_column", { input }),
  softDeleteColumn: (id: string) => invoke<void>("soft_delete_column", { id }),
  reorderColumns: (ids: string[]) =>
    invoke<void>("reorder_columns", { input: { ids } }),

  createItem: (categoryId: string, columnId: string, name: string, description = "") =>
    invoke<Item>("create_item", {
      input: { categoryId, columnId, name, description },
    }),
  updateItem: (input: { id: string; name?: string; description?: string }) =>
    invoke<Item>("update_item", { input }),
  softDeleteItem: (id: string) => invoke<void>("soft_delete_item", { id }),
  moveItem: (id: string, targetColumnId: string, targetIndex: number) =>
    invoke<Item>("move_item", {
      input: { id, targetColumnId, targetIndex },
    }),
  reorderItems: (categoryId: string, columnId: string, ids: string[]) =>
    invoke<void>("reorder_items", { input: { categoryId, columnId, ids } }),

  listTrash: () => invoke<TrashItem[]>("list_trash"),
  trashCount: () => invoke<number>("trash_count"),
  restoreEntity: (entityType: string, id: string, withChildren = false) =>
    invoke<RestoreResult>("restore_entity", {
      input: { entityType, id, withChildren },
    }),
  purgeEntity: (entityType: string, id: string) =>
    invoke<void>("purge_entity", { input: { entityType, id } }),
  purgeExpired: () => invoke<number>("purge_expired"),
  purgeAllTrash: () => invoke<number>("purge_all_trash"),
  runStartupMaintenance: () => invoke<number>("run_startup_maintenance"),

  exportJson: (includeTrash = true) =>
    invoke<string>("export_json", { input: { includeTrash } }),
  importJson: (json: string) => invoke<void>("import_json", { json }),
  getDbPath: () => invoke<string>("get_db_path"),
};
