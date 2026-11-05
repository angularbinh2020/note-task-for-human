/** Client-side helper notes for export/import v1 (server validates authoritatively). */
export const EXPORT_VERSION = 1;

export function isLikelyExportJson(raw: string): boolean {
  try {
    const data = JSON.parse(raw) as { version?: unknown; categories?: unknown };
    return data.version === EXPORT_VERSION && Array.isArray(data.categories);
  } catch {
    return false;
  }
}
