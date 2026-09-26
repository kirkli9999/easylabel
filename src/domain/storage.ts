import { z } from 'zod';
import {
  DEFAULT_PAPER,
  RULE_VERSION,
  paperSchema,
  productSchema,
  resetConfirmations,
  uid,
  type Product,
  type Paper,
} from './model';
export const STORAGE_KEY = 'easylabel.workspace.v1';
export const backupSchema = z
  .object({
    schemaVersion: z.literal(1),
    ruleVersion: z.string().max(100),
    exportedAt: z.string().max(100),
    products: z.array(productSchema).max(100),
    paper: paperSchema,
  })
  .strict();
export function makeBackup(products: Product[], paper: Paper) {
  return {
    schemaVersion: 1 as const,
    ruleVersion: RULE_VERSION,
    exportedAt: new Date().toISOString(),
    products,
    paper,
  };
}
export function parseBackup(text: string) {
  if (text.length > 2_000_000) throw new Error('備份超過 2 MB，請分批匯入。');
  const result = backupSchema.safeParse(JSON.parse(text));
  if (!result.success) throw new Error('備份格式或版本不相容。現有商品未變更，請保留原始檔案。');
  return result.data;
}
export function importProducts(text: string, existing: Product[]) {
  const parsed = parseBackup(text);
  if (parsed.products.length + existing.length > 100)
    throw new Error('商品總數最多 100 筆，請先備份並整理。');
  return [
    ...existing,
    ...parsed.products.map((p) => ({
      ...resetConfirmations(p),
      id: uid(),
      ingredients: p.ingredients.map((i) => ({ ...i, id: uid(), verified: false })),
      updatedAt: new Date().toISOString(),
    })),
  ];
}
export function loadWorkspace(): { products: Product[]; paper: Paper; error: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { products: [], paper: DEFAULT_PAPER, error: '' };
    const backup = parseBackup(saved);
    return { products: backup.products, paper: backup.paper, error: '' };
  } catch {
    return {
      products: [],
      paper: DEFAULT_PAPER,
      error: '無法讀取本機資料。原資料未覆蓋；請先下載原始備份或匯入有效備份。',
    };
  }
}
