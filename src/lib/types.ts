export interface Item {
  id: string;
  categoryId: string;
  columnId: string;
  name: string;
  description: string;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: Item[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
  sortOrder: number;
  collapsed: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  columns: Column[];
}

export interface TrashItem {
  entityType: "category" | "column" | "item" | string;
  id: string;
  name: string;
  detail: string;
  deletedAt: string;
  daysRemaining: number;
  parentHint: string | null;
}

export interface RestoreResult {
  restoredParents: string[];
  message: string | null;
}

export type Page = "home" | "trash" | "data";
