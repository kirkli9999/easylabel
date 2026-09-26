import type { Paper } from '../domain/model';

// Dimensions describe each label, not the package or the printable text area.
export const PAPER_PRESETS = [
  { id: 'standard', name: '一般雙張', width: 120, height: 130, hint: '一般烘焙商品的起點。' },
  { id: 'wide', name: '加寬雙張', width: 140, height: 130, hint: '營養表欄位不足時，可先試加寬。' },
  {
    id: 'four',
    name: '四張直式',
    width: 92,
    height: 135,
    hint: '9.2 × 13.5 公分，適合內容較精簡的商品。',
  },
  {
    id: 'large',
    name: '大版單張',
    width: 190,
    height: 260,
    hint: '成分、地址或其他資訊較多時使用。',
  },
] as const;

export function presetPaper(preset: (typeof PAPER_PRESETS)[number], cropMarks = true): Paper {
  return { width: preset.width, height: preset.height, margin: 10, gap: 6, cropMarks };
}
export function selectedPreset(paper: Paper) {
  return PAPER_PRESETS.find(
    (p) =>
      p.width === paper.width &&
      p.height === paper.height &&
      paper.margin === 10 &&
      paper.gap === 6,
  );
}
