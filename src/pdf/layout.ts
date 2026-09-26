import type { Paper } from '../domain/model';
import { paperSchema } from '../domain/model';
export const mm = (n: number) => n * 72 / 25.4;
export function sheetLayout(paper: Paper, quantity: number) {
  if (!paperSchema.safeParse(paper).success) throw new Error('紙張設定無效。邊界需至少 5 mm，所有尺寸需為有效數字。');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) throw new Error('列印數量須為 1–100 的整數。');
  const columns = Math.floor((210 - 2 * paper.margin + paper.gap + 1e-8) / (paper.width + paper.gap));
  const rows = Math.floor((297 - 2 * paper.margin + paper.gap + 1e-8) / (paper.height + paper.gap));
  if (columns < 1 || rows < 1) throw new Error('標籤尺寸加上邊界超過 A4 可用範圍，請調整尺寸或邊界。');
  const capacity = columns * rows;
  return { columns, rows, capacity, pages: Math.ceil(quantity / capacity), positions: Array.from({ length: quantity }, (_, i) => ({
    page: Math.floor(i / capacity), x: paper.margin + (i % columns) * (paper.width + paper.gap),
    y: paper.margin + Math.floor((i % capacity) / columns) * (paper.height + paper.gap),
  })) };
}
