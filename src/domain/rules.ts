import Decimal from 'decimal.js';
import {
  ALLERGENS,
  NUTRIENTS,
  type NutrientKey,
  type Product,
  type PrintJob,
  type Values,
} from './model';
import { RELEASE, releaseReady, type Release } from './release';

export const SOURCES = {
  basic: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?flno=22&pcode=L0040001',
  handbook: 'https://www.fda.gov.tw/tc/includes/GetFile.ashx?cid=42303&id=f639057140744869584',
  nutrition:
    'https://www.fda.gov.tw/tc/includes/GetFile.ashx?cid=42305&id=f639057139719594572&type=2',
  faq: 'https://www.fda.gov.tw/tc/includes/GetFile.ashx?cid=42306&id=f639057138540044743&type=2',
  claims: 'https://www.fda.gov.tw/tc/newsContent.aspx?cid=4&id=t622488',
};
export const RULES = {
  BASIC: {
    title: '基本標示',
    source: SOURCES.basic,
    provision: '第22條第1項',
    effectiveDate: null,
    status: 'current',
    appliesTo: '支援的包裝食品',
  },
  INGREDIENT: {
    title: '成分與排序',
    source: SOURCES.basic,
    provision: '第22條第1項第2、4款',
    effectiveDate: null,
    status: 'current',
    appliesTo: '二種以上混合內容物、添加物',
  },
  SCOPE: {
    title: '適用範圍',
    source: '',
    provision: '本工具v0.1產品範圍',
    effectiveDate: null,
    status: 'product-policy',
    appliesTo: '所有商品',
  },
  ALLERGEN: {
    title: '過敏原',
    source: SOURCES.handbook,
    provision: '食品過敏原標示規定第2、3點',
    effectiveDate: '2020-07-01',
    status: 'current',
    appliesTo: '含致過敏性內容物的包裝食品',
  },
  NUTRITION: {
    title: '營養格式',
    source: SOURCES.nutrition,
    provision: '營養標示規定第3、4、6、9點',
    effectiveDate: '2024-07-01',
    status: 'current',
    appliesTo: '一般包裝烘焙食品，固體/半固體',
  },
  ZERO: {
    title: '零標示',
    source: SOURCES.nutrition,
    provision: '第8點及附表二',
    effectiveDate: '2024-07-01',
    status: 'current',
    appliesTo: '印出零的營養素',
  },
  EXPIRY: {
    title: '有效日期',
    source: SOURCES.basic,
    provision: '第22條第1項第7款',
    effectiveDate: null,
    status: 'current',
    appliesTo: '支援的包裝食品',
  },
  CLAIMS: {
    title: '特殊宣稱',
    source: SOURCES.claims,
    provision: '營養宣稱規定；v0.1不支援',
    effectiveDate: '2026-01-01',
    status: 'current',
    appliesTo: '有宣稱的食品',
  },
  LAYOUT: {
    title: '字體與版面',
    source: SOURCES.handbook,
    provision: '施行細則第19條；固定字型另須實印量測',
    effectiveDate: null,
    status: 'current',
    appliesTo: '所有列印標籤；不套小包裝例外',
  },
  RELEASE: {
    title: '發布驗收',
    source: '',
    provision: '本專案品質政策，非事前送審要求',
    effectiveDate: null,
    status: 'product-policy',
    appliesTo: '正式輸出',
  },
} as const;
export type RuleId = keyof typeof RULES;
export type Issue = {
  rule: RuleId;
  severity: 'error' | 'pending' | 'warning';
  message: string;
  field?: string;
};
export const CHECKED_AT = '2026-09-27';
export function decimal(value: string): Decimal | null {
  if (!/^(?:\d+)(?:\.\d+)?$/.test(value.trim()) || value.trim().length > 30) return null;
  const n = new Decimal(value.trim());
  return n.isFinite() && n.gte(0) && n.lte(1_000_000) ? n : null;
}
export function roundLabel(value: string, allowTiny: boolean): string | null {
  const n = decimal(value);
  if (!n) return null;
  const regular = n.toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
  if (n.gt(0) && regular.isZero()) {
    if (!allowTiny) return null;
    const tiny = n.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return tiny.gt(0) ? tiny.toString() : null;
  }
  return regular.toString();
}
function threshold(key: NutrientKey, v: Values): boolean | null {
  const n = decimal(v[key]);
  if (!n) return null;
  if (key === 'trans') {
    const fat = decimal(v.fat);
    if (!fat) return null;
    return fat.lte(1) || n.lte('0.3');
  }
  if (key === 'energy') {
    const values = (['carbs', 'sugar', 'protein', 'fat', 'saturated', 'trans'] as const).map((k) =>
      threshold(k, v),
    );
    if (values.includes(null)) return null;
    return n.lte(4) && values.every(Boolean);
  }
  return n.lte(key === 'sodium' ? '5' : key === 'saturated' ? '0.1' : '0.5');
}
export function canZero(key: NutrientKey, serving: Values, hundred: Values): boolean | null {
  const a = threshold(key, serving),
    b = threshold(key, hundred);
  return a === null || b === null ? null : a && b;
}
export function nutritionOutput(p: Product) {
  const result = { perServing: {} as Values, per100: {} as Values };
  for (const basis of ['perServing', 'per100'] as const) {
    for (const { key } of NUTRIENTS) {
      result[basis][key] = p.nutrition.zero.includes(key)
        ? '0'
        : ((p.nutrition.kind === 'label'
            ? p.nutrition[basis][key].trim()
            : roundLabel(p.nutrition[basis][key], basis === 'perServing')) ?? '待確認');
      if (!p.nutrition[basis][key].trim()) result[basis][key] = '未填';
    }
  }
  return result;
}
export function ingredientText(p: Product) {
  return p.ingredients
    .filter((i) => i.name.trim())
    .map(
      (i) =>
        `${i.name.trim()}${i.compound && i.subIngredients.trim() ? `（${i.subIngredients.trim()}）` : ''}${i.additives.trim() ? `〔添加物：${i.additives.trim()}〕` : ''}`,
    )
    .join('、');
}
export function allergenText(p: Product) {
  const selected = ALLERGENS.filter((a) => p.allergens[a.key].status === 'present').map(
    (a) => a.label,
  );
  return selected.length ? `本產品含有${selected.join('、')}，不適合對其過敏體質者食用。` : '';
}
export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return (
    !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value && +value.slice(0, 4) >= 1900
  );
}
export function dateText(value: string) {
  return validDate(value)
    ? `西元 ${value.slice(0, 4)} 年 ${value.slice(5, 7)} 月 ${value.slice(8, 10)} 日`
    : '待填寫';
}
const scopeLabels = {
  domestic: '國內製造',
  packaged: '完整包裝',
  bakery: '一般烘焙點心',
  meatFree: '不含肉類原料',
  noClaims: '無營養／素食／有機等特殊宣稱',
  noSpecialCategory: '非專屬規範品類',
  noGmoLabel: '不涉及尚未支援的基因改造標示',
  noExtraWarning: '無需額外原料警語',
} as const;
export { scopeLabels };
export const claimPattern =
  /低糖|無糖|零糖|高蛋白|高纖|低脂|零脂|減糖|減鈉|無添加糖|不加糖|素食|蛋奶素|奶蛋素|全素|純素|有機|富含|高鈣|低鈉|無麩質|零反式|無反式|生酮/;
export function validate(p: Product, job: PrintJob, release: Release = RELEASE): Issue[] {
  const issues: Issue[] = [];
  const add = (rule: RuleId, severity: Issue['severity'], message: string, field?: string) =>
    issues.push({ rule, severity, message, field });
  for (const [key, name] of Object.entries(scopeLabels))
    if (p.scope[key as keyof typeof scopeLabels] !== 'yes')
      add('SCOPE', 'pending', `請確認「${name}」；不符或不明者僅供草稿。`, 'scope');
  if (p.scope.vacuum !== 'no' || !['ambient', 'chilled'].includes(p.scope.storage))
    add('SCOPE', 'pending', '第一版僅支援非真空、常溫或冷藏包裝。', 'scope');
  for (const [key, label] of [
    ['name', '品名'],
    ['origin', '原產地'],
    ['maker', '廠商名稱'],
    ['phone', '電話'],
    ['address', '地址'],
    ['storageText', '保存條件'],
  ] as const)
    if (!p[key].trim()) add('BASIC', 'error', `請填寫${label}。`, key);
  if (!decimal(p.netWeight)?.gt(0)) add('BASIC', 'error', '淨重需為大於零的公克數。', 'netWeight');
  if (p.phone && !/^[\d+()（）\s-]{5,30}$/.test(p.phone))
    add('BASIC', 'error', '電話格式無效，請填寫可聯絡的電話。', 'phone');
  if (!p.ingredients.length || p.ingredients.some((i) => !i.name.trim()))
    add('INGREDIENT', 'error', '請填入每項原料名稱，或移除空白原料。', 'ingredients');
  if (!p.ingredientOrderConfirmed)
    add('INGREDIENT', 'pending', '請確認原料已依實際含量由多至少排列。', 'ingredients');
  if (p.ingredients.some((i) => !i.verified || (i.compound && !i.subIngredients.trim())))
    add('INGREDIENT', 'pending', '原料／複合原料／添加物資料尚未逐項確認。', 'ingredients');
  if (!p.allergenConfirmed || ALLERGENS.some((a) => p.allergens[a.key].status === 'unknown'))
    add('ALLERGEN', 'pending', '請完成 11 項過敏原檢核並確認資料。', 'allergens');
  for (const a of ALLERGENS) {
    const item = p.allergens[a.key];
    if (item.status === 'exempt' && (!a.exception || !item.evidence.trim()))
      add('ALLERGEN', 'pending', `${a.label}的例外條件尚無可用依據。`, 'allergens');
  }
  const hints: [RegExp, (typeof ALLERGENS)[number]['key'], string][] = [
    [/小麥|麵粉/, 'gluten', '含麩質穀物'],
    [/奶油|牛奶|奶粉|乳清/, 'milk', '奶'],
    [/雞蛋|蛋白|蛋黃/, 'egg', '蛋'],
    [/花生/, 'peanut', '花生'],
    [/芝麻/, 'sesame', '芝麻'],
    [/大豆|黃豆|豆粉/, 'soy', '大豆'],
  ];
  for (const [rx, key, label] of hints)
    if (rx.test(ingredientText(p)) && p.allergens[key].status === 'absent')
      add(
        'ALLERGEN',
        'pending',
        `原料文字可能涉及${label}，請檢查含有/例外選項，勿只勾選「未含」。`,
        'allergens',
      );
  if (claimPattern.test(`${p.name} ${p.notes} ${p.storageText}`))
    add('CLAIMS', 'pending', '文字中出現可能的特殊宣稱，第一版未支援此類審查。', 'scope');
  if (!validDate(job.expiry))
    add('EXPIRY', 'error', '請填寫有效的西元年月日；保存天數不能替代有效日期。', 'expiry');
  else if (job.expiry < new Date().toLocaleDateString('sv-SE'))
    add('EXPIRY', 'pending', '有效日期已過，請確認是否輸入正確。', 'expiry');
  if (!job.confirmed) add('EXPIRY', 'pending', '請確認這一批的有效日期。', 'expiry');
  if (!Number.isInteger(job.quantity) || job.quantity < 1 || job.quantity > 100)
    add('LAYOUT', 'error', '列印數量須為 1–100 的整數。');
  if (job.batch.length > 80) add('LAYOUT', 'error', '批號長度請控制在 80 字以內。');
  const n = p.nutrition;
  const portion = decimal(n.servingSize),
    count = decimal(n.servings),
    net = decimal(p.netWeight);
  if (!portion?.gt(0) || !roundLabel(n.servingSize, true))
    add('NUTRITION', 'error', '每份量必須大於零且可在允許位數下呈現。', 'nutrition');
  if (!count?.gt(0) || !roundLabel(n.servings, false))
    add('NUTRITION', 'error', '份數需大於零且可用整數或一位小數呈現。', 'nutrition');
  if (!n.source.trim() || !n.confirmed)
    add('NUTRITION', 'pending', '請填寫營養資料來源，並確認原始值與列印值。', 'nutrition');
  // Use the parsed value: Decimal rejects the surrounding spaces that decimal() trims.
  if (portion && count && net && portion.times(count).minus(net).abs().gt('0.1'))
    add('NUTRITION', 'warning', '每份量 × 份數與淨重不同，請核對份量及修整差異。', 'nutrition');
  const rawServing = n.kind === 'raw' ? n.perServing : n.hasRawEvidence ? n.rawPerServing : null;
  const rawHundred = n.kind === 'raw' ? n.per100 : n.hasRawEvidence ? n.rawPer100 : null;
  for (const { key, label } of NUTRIENTS) {
    for (const basis of ['perServing', 'per100'] as const) {
      const value = decimal(n[basis][key]);
      if (!value) {
        add(
          'NUTRITION',
          'error',
          `${label.trim()}的${basis === 'perServing' ? '每份' : '每100公克'}數值無效；空白不是零。`,
          'nutrition',
        );
        continue;
      }
      if (
        n.kind === 'label' &&
        value.decimalPlaces() > 1 &&
        !(basis === 'perServing' && value.gt(0) && value.lt('0.05') && value.decimalPlaces() <= 2)
      )
        add(
          'NUTRITION',
          'pending',
          `${label.trim()}既有標示的位數需確認，請提供未修整數據。`,
          'nutrition',
        );
      if (
        n.kind === 'raw' &&
        !n.zero.includes(key) &&
        roundLabel(n[basis][key], basis === 'perServing') === null
      )
        add(
          'NUTRITION',
          'pending',
          `${label.trim()}數值太小，請確認零標示條件或可適用的微量例外。`,
          'nutrition',
        );
    }
    const zeroRequested =
      n.zero.includes(key) ||
      decimal(n.perServing[key])?.isZero() ||
      decimal(n.per100[key])?.isZero();
    if (zeroRequested) {
      if (!rawServing || !rawHundred)
        add(
          'ZERO',
          'pending',
          `${label.trim()}列印為零，需提供修整前兩個基準的原始值。`,
          'nutrition',
        );
      else {
        const allowed = canZero(key, rawServing, rawHundred);
        if (allowed === null)
          add('ZERO', 'pending', `${label.trim()}零標示的原始／相依數據不足。`, 'nutrition');
        else if (!allowed)
          add('ZERO', 'error', `${label.trim()}不符合每份及每100公克的零標示條件。`, 'nutrition');
      }
    }
    const a = decimal(n.perServing[key]),
      b = decimal(n.per100[key]);
    if (
      portion &&
      a &&
      b &&
      n.kind === 'raw' &&
      a.minus(b.times(portion).div(100)).abs().gt('0.01')
    )
      add(
        'NUTRITION',
        'warning',
        `${label.trim()}兩欄原始數據與份量比例不同，請核對資料來源。`,
        'nutrition',
      );
  }
  for (const basis of ['perServing', 'per100'] as const) {
    const fat = decimal(n[basis].fat),
      sat = decimal(n[basis].saturated),
      trans = decimal(n[basis].trans),
      carbs = decimal(n[basis].carbs),
      sugar = decimal(n[basis].sugar);
    if (fat && sat && trans && (sat.gt(fat) || trans.gt(fat)))
      add('NUTRITION', 'pending', '飽和或反式脂肪高於總脂肪，請核對數據。', 'nutrition');
    if (sugar && carbs && sugar.gt(carbs))
      add('NUTRITION', 'pending', '糖高於碳水化合物，請核對數據。', 'nutrition');
  }
  if (!releaseReady(release))
    add('RELEASE', 'pending', '測試版尚待專業法規審閱與實印驗收，目前僅提供草稿 PDF。');
  return issues;
}
