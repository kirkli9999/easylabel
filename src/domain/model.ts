import { z } from 'zod';

export const RULE_VERSION = 'tw-bakery-2026-09-v1';
export const NUTRIENTS = [
  { key: 'energy', label: '熱量', unit: '大卡' },
  { key: 'protein', label: '蛋白質', unit: '公克' },
  { key: 'fat', label: '脂肪', unit: '公克' },
  { key: 'saturated', label: '　飽和脂肪', unit: '公克' },
  { key: 'trans', label: '　反式脂肪', unit: '公克' },
  { key: 'carbs', label: '碳水化合物', unit: '公克' },
  { key: 'sugar', label: '　糖', unit: '公克' },
  { key: 'sodium', label: '鈉', unit: '毫克' },
] as const;
export type NutrientKey = (typeof NUTRIENTS)[number]['key'];
export const ALLERGENS = [
  { key: 'crustacean', label: '甲殼類', exception: '' },
  { key: 'mango', label: '芒果', exception: '' },
  { key: 'peanut', label: '花生', exception: '' },
  {
    key: 'milk',
    label: '牛奶、羊奶',
    exception: '由牛奶、羊奶取得的乳糖醇。需確認供應商原料資料。',
  },
  { key: 'egg', label: '蛋', exception: '' },
  { key: 'nuts', label: '堅果類', exception: '' },
  { key: 'sesame', label: '芝麻', exception: '' },
  {
    key: 'gluten',
    label: '含麩質之穀物',
    exception: '由穀類製得的葡萄糖漿、麥芽糊精及酒類。需確認實際製程與來源。',
  },
  {
    key: 'soy',
    label: '大豆',
    exception:
      '公告列明高度提煉或純化的大豆油脂、混合生育酚及衍生物、植物固醇與酯。一般大豆製品不適用。',
  },
  { key: 'fish', label: '魚類', exception: '魚明膠限作維生素/類胡蘿蔔素製劑載體或酒類澄清用途。' },
  {
    key: 'sulfite',
    label: '亞硫酸鹽類',
    exception: '終產品以二氧化硫殘留量計達 10 mg/kg（含）適用。低於門檻需有依據。',
  },
] as const;
export type AllergenKey = (typeof ALLERGENS)[number]['key'];
const text = z.string().max(5000);
const numeric = z.string().max(40);
const numericSet = z
  .object({
    energy: numeric,
    protein: numeric,
    fat: numeric,
    saturated: numeric,
    trans: numeric,
    carbs: numeric,
    sugar: numeric,
    sodium: numeric,
  })
  .strict();
export type Values = z.infer<typeof numericSet>;
const answer = z.enum(['yes', 'no', 'unknown']);
const allergenEntry = z
  .object({ status: z.enum(['unknown', 'absent', 'present', 'exempt']), evidence: text })
  .strict();
const allergensSchema = z
  .object(
    Object.fromEntries(ALLERGENS.map((a) => [a.key, allergenEntry])) as Record<
      AllergenKey,
      typeof allergenEntry
    >,
  )
  .strict();
export const productSchema = z
  .object({
    id: z.string().min(1).max(100),
    name: text,
    netWeight: numeric,
    origin: text,
    maker: text,
    phone: text,
    address: text,
    storageText: text,
    notes: text,
    scope: z
      .object({
        domestic: answer,
        packaged: answer,
        bakery: answer,
        meatFree: answer,
        noClaims: answer,
        noSpecialCategory: answer,
        noGmoLabel: answer,
        noExtraWarning: answer,
        storage: z.enum(['unknown', 'ambient', 'chilled', 'frozen']),
        vacuum: answer,
      })
      .strict(),
    ingredients: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            name: text,
            compound: z.boolean(),
            subIngredients: text,
            additives: text,
            verified: z.boolean(),
          })
          .strict(),
      )
      .max(100),
    ingredientOrderConfirmed: z.boolean(),
    allergens: allergensSchema,
    allergenConfirmed: z.boolean(),
    sharedLine: text,
    nutrition: z
      .object({
        kind: z.enum(['raw', 'label']),
        source: text,
        servingSize: numeric,
        servings: numeric,
        perServing: numericSet,
        per100: numericSet,
        zero: z
          .array(
            z.enum(['energy', 'protein', 'fat', 'saturated', 'trans', 'carbs', 'sugar', 'sodium']),
          )
          .max(8),
        hasRawEvidence: z.boolean(),
        rawPerServing: numericSet,
        rawPer100: numericSet,
        confirmed: z.boolean(),
      })
      .strict(),
    confirmedAt: text,
    updatedAt: text,
  })
  .strict();
export type Product = z.infer<typeof productSchema>;
export const paperSchema = z
  .object({
    width: z.number().finite().positive().max(210),
    height: z.number().finite().positive().max(297),
    margin: z.number().finite().min(5).max(50),
    gap: z.number().finite().min(0).max(30),
    cropMarks: z.boolean(),
  })
  .strict();
export type Paper = z.infer<typeof paperSchema>;
export const DEFAULT_PAPER: Paper = {
  width: 120,
  height: 130,
  margin: 10,
  gap: 6,
  cropMarks: true,
};
export type PrintJob = { expiry: string; batch: string; quantity: number; confirmed: boolean };
export const newJob = (): PrintJob => ({ expiry: '', batch: '', quantity: 2, confirmed: false });
export const emptyValues = (): Values => ({
  energy: '',
  protein: '',
  fat: '',
  saturated: '',
  trans: '',
  carbs: '',
  sugar: '',
  sodium: '',
});
export const uid = () => crypto.randomUUID();
export function newProduct(): Product {
  return {
    id: uid(),
    name: '',
    netWeight: '',
    origin: '',
    maker: '',
    phone: '',
    address: '',
    storageText: '',
    notes: '',
    scope: {
      domestic: 'unknown',
      packaged: 'unknown',
      bakery: 'unknown',
      meatFree: 'unknown',
      noClaims: 'unknown',
      noSpecialCategory: 'unknown',
      noGmoLabel: 'unknown',
      noExtraWarning: 'unknown',
      storage: 'unknown',
      vacuum: 'unknown',
    },
    ingredients: [
      { id: uid(), name: '', compound: false, subIngredients: '', additives: '', verified: false },
    ],
    ingredientOrderConfirmed: false,
    allergens: Object.fromEntries(
      ALLERGENS.map((a) => [a.key, { status: 'unknown', evidence: '' }]),
    ) as Product['allergens'],
    allergenConfirmed: false,
    sharedLine: '',
    nutrition: {
      kind: 'raw',
      source: '',
      servingSize: '',
      servings: '',
      perServing: emptyValues(),
      per100: emptyValues(),
      zero: [],
      hasRawEvidence: false,
      rawPerServing: emptyValues(),
      rawPer100: emptyValues(),
      confirmed: false,
    },
    confirmedAt: '',
    updatedAt: new Date().toISOString(),
  };
}
export function resetConfirmations(p: Product): Product {
  return {
    ...p,
    confirmedAt: '',
    ingredientOrderConfirmed: false,
    allergenConfirmed: false,
    nutrition: { ...p.nutrition, confirmed: false },
  };
}
export function demoProduct(): Product {
  const p = newProduct();
  return {
    ...p,
    name: '原味奶油餅乾',
    netWeight: '200',
    origin: '台灣',
    maker: '日常烘焙工作室（虛構範例）',
    phone: '02-0000-0000',
    address: '範例市範例區烘焙路 12 號',
    storageText: '請置於陰涼乾燥處，開封後儘速食用。',
    scope: {
      domestic: 'yes',
      packaged: 'yes',
      bakery: 'yes',
      meatFree: 'yes',
      noClaims: 'yes',
      noSpecialCategory: 'yes',
      noGmoLabel: 'yes',
      noExtraWarning: 'yes',
      storage: 'ambient',
      vacuum: 'no',
    },
    ingredients: ['小麥麵粉', '奶油', '砂糖', '雞蛋'].map((name) => ({
      id: uid(),
      name,
      compound: false,
      subIngredients: '',
      additives: '',
      verified: true,
    })),
    ingredientOrderConfirmed: true,
    allergens: Object.fromEntries(
      ALLERGENS.map((a) => [
        a.key,
        {
          status: ['gluten', 'milk', 'egg'].includes(a.key) ? 'present' : 'absent',
          evidence: '虛構範例資料，非真實商品判定。',
        },
      ]),
    ) as Product['allergens'],
    allergenConfirmed: true,
    nutrition: {
      ...p.nutrition,
      source: '操作示範：虛構數據，請勿直接用於販售商品',
      servingSize: '25',
      servings: '8',
      perServing: {
        energy: '125',
        protein: '1.5',
        fat: '6',
        saturated: '3.5',
        trans: '0.01',
        carbs: '16.25',
        sugar: '5',
        sodium: '40',
      },
      per100: {
        energy: '500',
        protein: '6',
        fat: '24',
        saturated: '14',
        trans: '0.04',
        carbs: '65',
        sugar: '20',
        sodium: '160',
      },
      zero: ['trans'],
      confirmed: true,
    },
    confirmedAt: new Date().toISOString(),
  };
}
