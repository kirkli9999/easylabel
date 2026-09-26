import { PDFDocument, rgb, degrees, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Paper, PrintJob, Product } from '../domain/model';
import { NUTRIENTS } from '../domain/model';
import {
  allergenText,
  dateText,
  ingredientText,
  nutritionOutput,
  roundLabel,
  validate,
} from '../domain/rules';
import { RELEASE, type Release } from '../domain/release';
import { mm, sheetLayout } from './layout';

export const FONT_SIZE = 10; // Template setting only; physical legal minimum remains unverified.
const LINE = 14.5;
const BLACK = rgb(0.05, 0.05, 0.05);
type TextOp = { type: 'text'; text: string; x: number; y: number; size: number };
type LineOp = { type: 'line'; x: number; y: number; x2: number; y2: number; weight: number };
type Op = TextOp | LineOp;
function ensureGlyphs(text: string, font: PDFFont) {
  const chars = new Set(font.getCharacterSet());
  const missing = [
    ...new Set([...text].filter((c) => !/[\n\r]/.test(c) && !chars.has(c.codePointAt(0)!))),
  ];
  if (missing.length)
    throw new Error(`字型無法呈現「${missing.join('')}」。請改用支援的字元；檔案尚未輸出。`);
}
export function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  ensureGlyphs(text, font);
  const lines: string[] = [];
  for (const para of text.replace(/\r/g, '').split('\n')) {
    let line = '';
    for (const char of para) {
      if (font.widthOfTextAtSize(char, size) > width)
        throw new Error('標籤寬度不足以放入單一字元。');
      if (font.widthOfTextAtSize(line + char, size) > width && line) {
        lines.push(line);
        line = char;
      } else line += char;
    }
    if (line || !para) lines.push(line);
  }
  return lines;
}
function compose(p: Product, job: PrintJob, paper: Paper, font: PDFFont): Op[] {
  const ops: Op[] = [];
  // Narrow labels use a fixed stacked template, never smaller type or omitted content.
  const stacked = paper.width < 110;
  const lineHeight = stacked ? 12.5 : LINE;
  const pad = mm(5),
    width = mm(paper.width),
    inner = width - pad * 2,
    maxBottom = mm(paper.height) - pad;
  let cursor = pad;
  function text(
    value: string,
    size = FONT_SIZE,
    center = false,
    availableWidth = inner,
    offset = pad,
  ) {
    for (const line of wrapText(value, font, size, availableWidth)) {
      const step = size === FONT_SIZE ? lineHeight : size * 1.35;
      cursor += step;
      ops.push({
        type: 'text',
        text: line,
        size,
        x: center ? offset + (availableWidth - font.widthOfTextAtSize(line, size)) / 2 : offset,
        y: cursor,
      });
    }
  }
  function line(weight = 0.6) {
    cursor += 4;
    ops.push({ type: 'line', x: pad, y: cursor, x2: width - pad, y2: cursor, weight });
    cursor += 4;
  }
  text(p.name || '未命名商品', 14);
  cursor += 3;
  text(`成分：${ingredientText(p) || '待填寫'}`);
  text(`淨重：${p.netWeight || '未填'} 公克　原產地：${p.origin || '待填寫'}`);
  if (p.storageText) text(`保存方式：${p.storageText}`);
  const allergens = allergenText(p);
  if (allergens) text(allergens);
  if (p.sharedLine) text(`同產線資訊：${p.sharedLine}`);
  line(1.2);
  const columnsStart = cursor;
  const tableWidth = stacked ? inner : inner * 0.63,
    detailX = stacked ? pad : pad + tableWidth + mm(4),
    detailWidth = stacked ? inner : inner - tableWidth - mm(4);
  text('營養標示', 12, true, tableWidth);
  text(
    `每一份量 ${roundLabel(p.nutrition.servingSize, true) ?? '未填'} 公克`,
    FONT_SIZE,
    false,
    tableWidth,
  );
  text(
    `本包裝含 ${roundLabel(p.nutrition.servings, false) ?? '未填'} 份`,
    FONT_SIZE,
    false,
    tableWidth,
  );
  cursor += 4;
  ops.push({ type: 'line', x: pad, y: cursor, x2: pad + tableWidth, y2: cursor, weight: 0.8 });
  cursor += 4;
  const right = pad + tableWidth - 2,
    middle = pad + tableWidth * 0.64;
  function row(label: string, a: string, b: string) {
    cursor += lineHeight;
    const firstWidth = tableWidth * 0.35;
    const available = tableWidth * 0.3;
    for (const s of [label, a, b]) ensureGlyphs(s, font);
    if (
      font.widthOfTextAtSize(label, FONT_SIZE) > firstWidth ||
      font.widthOfTextAtSize(a, FONT_SIZE) > available ||
      font.widthOfTextAtSize(b, FONT_SIZE) > available
    )
      throw new Error(
        `營養表「${label || '欄位標題'}」放不下。請到列印設定增加寬度或選「加寬雙張」，並核對數值是否誤填；不要刪減正確數據。`,
      );
    ops.push(
      { type: 'text', text: label, x: pad, y: cursor, size: FONT_SIZE },
      {
        type: 'text',
        text: a,
        x: middle - font.widthOfTextAtSize(a, FONT_SIZE),
        y: cursor,
        size: FONT_SIZE,
      },
      {
        type: 'text',
        text: b,
        x: right - font.widthOfTextAtSize(b, FONT_SIZE),
        y: cursor,
        size: FONT_SIZE,
      },
    );
  }
  row('', '每份', '每100公克');
  const output = nutritionOutput(p);
  for (const item of NUTRIENTS)
    row(
      item.label,
      `${output.perServing[item.key]} ${item.unit}`,
      `${output.per100[item.key]} ${item.unit}`,
    );
  cursor += 5;
  ops.push({ type: 'line', x: pad, y: cursor, x2: pad + tableWidth, y2: cursor, weight: 1.2 });
  const tableEnd = cursor;
  cursor = stacked ? tableEnd + 4 : columnsStart;
  for (const entry of [
    `負責廠商：${p.maker || '待填寫'}`,
    `電話：${p.phone || '待填寫'}`,
    `地址：${p.address || '待填寫'}`,
    `有效日期：${dateText(job.expiry)}`,
    ...(job.batch ? [`批號：${job.batch}`] : []),
    ...(p.notes ? [p.notes] : []),
  ]) {
    text(entry, FONT_SIZE, false, detailWidth, detailX);
    cursor += stacked ? 1 : 3;
  }
  cursor = Math.max(cursor, tableEnd);
  if (cursor > maxBottom)
    throw new Error(
      `內容需要約 ${Math.ceil(((cursor + pad) * 25.4) / 72)} mm 高，目前為 ${paper.height} mm。請加高標籤或精簡內容；不會縮小字體或裁掉文字。`,
    );
  return ops;
}
function drawOps(page: PDFPage, ops: Op[], font: PDFFont, x: number, top: number) {
  for (const op of ops) {
    if (op.type === 'text')
      page.drawText(op.text, { x: x + op.x, y: top - op.y, size: op.size, font, color: BLACK });
    else
      page.drawLine({
        start: { x: x + op.x, y: top - op.y },
        end: { x: x + op.x2, y: top - op.y2 },
        thickness: op.weight,
        color: BLACK,
      });
  }
}
function crop(page: PDFPage, x: number, top: number, w: number, h: number) {
  const len = mm(2),
    offset = mm(0.6);
  for (const cx of [x, x + w])
    for (const cy of [top, top - h]) {
      const dx = cx === x ? -1 : 1,
        dy = cy === top ? 1 : -1;
      page.drawLine({
        start: { x: cx + offset * dx, y: cy },
        end: { x: cx + len * dx, y: cy },
        thickness: 0.4,
        color: BLACK,
      });
      page.drawLine({
        start: { x: cx, y: cy + offset * dy },
        end: { x: cx, y: cy + len * dy },
        thickness: 0.4,
        color: BLACK,
      });
    }
}
export async function buildPdf(
  p: Product,
  job: PrintJob,
  paper: Paper,
  fontBytes: Uint8Array,
  options: { draft: boolean; release?: Release },
) {
  const release = options.release ?? RELEASE;
  const issues = validate(p, job, release);
  if (!options.draft && issues.some((i) => i.severity !== 'warning'))
    throw new Error('仍有錯誤或待確認項目，只能輸出草稿。');
  const grid = sheetLayout(paper, job.quantity);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  // Full CFF embedding avoids fontkit's broken CJK CFF subset outlines.
  const font = await doc.embedFont(fontBytes, { subset: false });
  const ops = compose(p, job, paper, font);
  const pages = Array.from({ length: grid.pages }, () => doc.addPage([mm(210), mm(297)]));
  for (const pos of grid.positions) {
    const page = pages[pos.page],
      x = mm(pos.x),
      top = mm(297 - pos.y),
      w = mm(paper.width),
      h = mm(paper.height);
    drawOps(page, ops, font, x, top);
    if (paper.cropMarks) crop(page, x, top, w, h);
    if (options.draft) {
      const mark = '草稿／待確認';
      page.drawText(mark, {
        x: x + mm(6),
        y: top - h * 0.7,
        size: 30,
        font,
        color: rgb(0.6, 0.18, 0.12),
        opacity: 0.25,
        rotate: degrees(25),
      });
    }
  }
  doc.setTitle(`${p.name || '食品標籤'}${options.draft ? '（草稿）' : ''}`);
  doc.setProducer('EasyLabel - browser-local PDF');
  return {
    bytes: await doc.save(),
    pages: grid.pages,
    perPage: grid.capacity,
    draft: options.draft,
  };
}
export async function buildCalibration(fontBytes: Uint8Array) {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: false });
  const page = doc.addPage([mm(210), mm(297)]);
  page.drawText('A4 列印尺寸測試', { x: mm(20), y: mm(270), size: 20, font });
  const instructions = [
    '以 A4、實際大小／100% 列印，請勿使用符合頁面。',
    '用尺量測下方線段：應為 100 mm。',
    '此測試僅確認尺寸；法定字體大小仍需逐項實印量測。',
    '請記錄印表機、驅動、紙張及列印設定。',
  ];
  instructions.forEach((s, i) =>
    page.drawText(s, { x: mm(20), y: mm(250 - i * 8), font, size: 11 }),
  );
  page.drawLine({
    start: { x: mm(20), y: mm(190) },
    end: { x: mm(120), y: mm(190) },
    thickness: 1,
  });
  for (let i = 0; i <= 10; i++)
    page.drawLine({
      start: { x: mm(20 + i * 10), y: mm(188) },
      end: { x: mm(20 + i * 10), y: mm(192) },
      thickness: 0.5,
    });
  page.drawText('100 mm', { x: mm(63), y: mm(181), font, size: 12 });
  page.drawText('固定模板 10pt 字樣：品名、有效日期 2026、0123456789、公克', {
    x: mm(20),
    y: mm(165),
    font,
    size: FONT_SIZE,
  });
  return doc.save();
}
