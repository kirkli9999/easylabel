import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { demoProduct, DEFAULT_PAPER } from '../src/domain/model';
import { buildPdf, buildCalibration } from '../src/pdf/generate';
import { sheetLayout, mm } from '../src/pdf/layout';
import { PAPER_PRESETS, presetPaper } from '../src/pdf/presets';
let font: Uint8Array;
beforeAll(async () => {
  font = new Uint8Array(await readFile('public/fonts/NotoSansCJKtc-Regular.otf'));
});
const job = { expiry: '2099-12-31', batch: '', quantity: 2, confirmed: true };
describe('sheet geometry', () => {
  it('fits four 92 × 135 labels without crossing margins; both sides over 100 cannot fit four', () => {
    const paper = presetPaper(PAPER_PRESETS[2]);
    const grid = sheetLayout(paper, 5);
    expect([grid.columns, grid.rows, grid.capacity, grid.pages]).toEqual([2, 2, 4, 2]);
    expect(grid.positions[3]).toEqual({ page: 0, x: 108, y: 151 });
    expect(grid.positions[4]).toEqual({ page: 1, x: 10, y: 10 });
    expect(sheetLayout({ ...paper, width: 92.5 }, 4).capacity).toBe(2);
    expect(sheetLayout({ ...paper, width: 101, height: 101 }, 4).capacity).toBe(2);
  });
  it.each([
    [1, 1],
    [2, 1],
    [3, 2],
    [100, 50],
  ])('%s labels = %s pages', (q, pages) => {
    const result = sheetLayout(DEFAULT_PAPER, q);
    expect(result.pages).toBe(pages);
    expect(result.positions).toHaveLength(q);
    expect(result.capacity).toBe(2);
    expect(
      result.positions.every(
        (p) => p.x + DEFAULT_PAPER.width <= 200 && p.y + DEFAULT_PAPER.height <= 287,
      ),
    ).toBe(true);
  });
  it('rejects non-fitting paper and noninteger/invalid count', () => {
    expect(() => sheetLayout({ ...DEFAULT_PAPER, width: 210 }, 2)).toThrow();
    for (const q of [0, 101, 1.2, NaN]) expect(() => sheetLayout(DEFAULT_PAPER, q)).toThrow();
    expect(() => sheetLayout({ ...DEFAULT_PAPER, width: NaN }, 2)).toThrow();
  });
});
describe('actual embedded-font PDF', () => {
  it.each(PAPER_PRESETS)(
    'renders the fictional sample in $name without shrinking',
    async (preset) => {
      const paper = presetPaper(preset);
      const capacity = sheetLayout(paper, 1).capacity;
      const result = await buildPdf(
        demoProduct(),
        { ...job, quantity: capacity + 1 },
        paper,
        font,
        { draft: true },
      );
      expect(result.perPage).toBe(capacity);
      expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(2);
    },
  );
  it('rejects excess content in four-up rather than losing required information', async () => {
    const p = demoProduct();
    p.address = '很長的地址'.repeat(30);
    await expect(
      buildPdf(p, job, presetPaper(PAPER_PRESETS[2]), font, { draft: true }),
    ).rejects.toThrow('需要約');
  });
  it('renders default two-label layout at exact A4 dimensions', async () => {
    const result = await buildPdf(demoProduct(), job, DEFAULT_PAPER, font, { draft: true });
    const doc = await PDFDocument.load(result.bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getWidth()).toBeCloseTo(mm(210));
    expect(doc.getPage(0).getHeight()).toBeCloseTo(mm(297));
    expect(result.draft).toBe(true);
    expect(result.bytes.length).toBeGreaterThan(5000);
  });
  it('refuses formal export before actual release checks', async () => {
    await expect(
      buildPdf(demoProduct(), job, DEFAULT_PAPER, font, { draft: false }),
    ).rejects.toThrow('草稿');
  });
  it('blocks missing glyphs and overflows without producing truncated drafts', async () => {
    const p = demoProduct();
    p.name = '餅乾🧑‍🍳';
    await expect(buildPdf(p, job, DEFAULT_PAPER, font, { draft: true })).rejects.toThrow('字型');
    p.name = '餅乾';
    p.address = '非常長的地址'.repeat(100);
    await expect(buildPdf(p, job, DEFAULT_PAPER, font, { draft: true })).rejects.toThrow('需要約');
  });
  it('exports a separate A4 calibration sheet', async () => {
    const doc = await PDFDocument.load(await buildCalibration(font));
    expect(doc.getPageCount()).toBe(1);
  });
});
