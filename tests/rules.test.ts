import { describe, it, expect } from 'vitest';
import { demoProduct, emptyValues, RULE_VERSION } from '../src/domain/model';
import { canZero, decimal, roundLabel, validate, nutritionOutput, validDate, allergenText } from '../src/domain/rules';
import { releaseReady } from '../src/domain/release';
const approved = { legalReviewed: true, printVerified: true, reviewedAt: '2026-09-27', evidence: 'TEST FIXTURE ONLY' };
const job = { expiry: '2099-02-28', batch: '', quantity: 2, confirmed: true };
const zero = () => Object.fromEntries(Object.keys(emptyValues()).map(k => [k, '0'])) as ReturnType<typeof emptyValues>;
describe('decimal and legal rounding boundaries', () => {
  it('rejects blank, negative, scientific, NaN, unbounded input', () => {
    for (const value of ['', '-1', 'NaN', 'Infinity', '1e2', '1000001', '0x10']) expect(decimal(value)).toBeNull();
    expect(decimal('0')?.toString()).toBe('0');
  });
  it('rounds half up in decimal without binary precision loss', () => {
    expect(roundLabel('1.25', false)).toBe('1.3');
    expect(roundLabel('1.15', false)).toBe('1.2');
    expect(roundLabel('0.03', true)).toBe('0.03');
    expect(roundLabel('0.03', false)).toBeNull();
    expect(roundLabel('0.001', true)).toBeNull();
  });
  it.each(['protein', 'fat', 'carbs', 'sugar'] as const)('%s respects inclusive 0.5 without rounding first', key => {
    for (const [value, allowed] of [['0.4999', true], ['0.5', true], ['0.5001', false], ['0.51', false]] as const) expect(canZero(key, { ...zero(), [key]: value }, zero())).toBe(allowed);
  });
  it('checks both bases even when each 100g qualifies', () => { expect(canZero('sugar', { ...zero(), sugar: '0.8' }, { ...zero(), sugar: '0.4' })).toBe(false); });
  it('sodium and saturated thresholds inclusive', () => {
    expect(canZero('sodium', { ...zero(), sodium: '5' }, zero())).toBe(true);
    expect(canZero('sodium', { ...zero(), sodium: '5.00001' }, zero())).toBe(false);
    expect(canZero('saturated', { ...zero(), saturated: '0.1' }, zero())).toBe(true);
    expect(canZero('saturated', { ...zero(), saturated: '0.100001' }, zero())).toBe(false);
  });
  it('trans depends on fat OR trans at BOTH bases', () => {
    expect(canZero('trans', { ...zero(), fat: '1', trans: '0.5' }, { ...zero(), fat: '2', trans: '0.3' })).toBe(true);
    expect(canZero('trans', { ...zero(), fat: '1.01', trans: '0.31' }, zero())).toBe(false);
    expect(canZero('trans', { ...zero(), fat: '' }, zero())).toBeNull();
  });
  it('energy depends on all six other nutrients', () => {
    expect(canZero('energy', { ...zero(), energy: '4' }, zero())).toBe(true);
    expect(canZero('energy', { ...zero(), energy: '4.01' }, zero())).toBe(false);
    expect(canZero('energy', { ...zero(), sugar: '0.51' }, zero())).toBe(false);
  });
});
describe('product checks', () => {
  it('fictional complete data passes supported rules with fixture release approval', () => {
    expect(validate(demoProduct(), job, approved).filter(i => i.severity !== 'warning')).toEqual([]);
  });
  it('default release can only produce drafts', () => {
    expect(validate(demoProduct(), job).some(i => i.rule === 'RELEASE')).toBe(true);
    expect(releaseReady()).toBe(false);
    expect(releaseReady({ ...approved, evidence: '' })).toBe(false);
  });
  it('basic required fields and unknown expiry block final output', () => {
    const p = demoProduct(); p.address = ''; p.phone = ''; p.origin = '';
    expect(validate(p, { ...job, expiry: '' }, approved).filter(i => i.severity === 'error').length).toBe(4);
  });
  it('checks calendar reality and leap years', () => {
    expect(validDate('2028-02-29')).toBe(true); expect(validDate('2027-02-29')).toBe(false);
    expect(validDate('2026-04-31')).toBe(false); expect(validDate('30天')).toBe(false);
  });
  it('compound ingredients and order need confirmation', () => {
    const p = demoProduct(); p.ingredients[0].compound = true; p.ingredientOrderConfirmed = false;
    expect(validate(p, job, approved).filter(i => i.rule === 'INGREDIENT')).toHaveLength(2);
  });
  it('allergen keywords do not silently set declarations', () => {
    const p = demoProduct(); p.allergens.milk.status = 'absent';
    expect(validate(p, job, approved).some(i => i.rule === 'ALLERGEN')).toBe(true);
    expect(allergenText(p)).not.toContain('牛奶');
  });
  it('unknown allergens and unsupported exceptions remain pending', () => {
    const p = demoProduct(); p.allergens.nuts.status = 'unknown'; p.allergens.peanut.status = 'exempt'; p.allergens.peanut.evidence = 'invalid';
    expect(validate(p, job, approved).filter(i => i.rule === 'ALLERGEN')).toHaveLength(2);
  });
  it('free text special claims cannot bypass scope answer', () => {
    const p = demoProduct(); p.name = '低糖餅乾';
    expect(validate(p, job, approved).some(i => i.rule === 'CLAIMS')).toBe(true);
  });
  it('frozen, loose, meat-containing are unsupported', () => {
    const p = demoProduct(); p.scope.storage = 'frozen'; p.scope.packaged = 'no'; p.scope.meatFree = 'no';
    expect(validate(p, job, approved).filter(i => i.rule === 'SCOPE')).toHaveLength(3);
  });
  it('label zeros without original evidence cannot pass', () => {
    const p = demoProduct(); p.nutrition.kind = 'label'; p.nutrition.per100.trans = '0'; p.nutrition.perServing.trans = '0';
    expect(validate(p, job, approved).some(i => i.rule === 'ZERO' && i.severity === 'pending')).toBe(true);
    p.nutrition.hasRawEvidence = true; p.nutrition.rawPer100 = { ...p.nutrition.per100, trans: '0.04' }; p.nutrition.rawPerServing = { ...p.nutrition.perServing, trans: '0.01' };
    expect(validate(p, job, approved).filter(i => i.rule === 'ZERO')).toEqual([]);
  });
  it('does not mutate source or turn nonzero into zero automatically', () => {
    const p = demoProduct(); const original = JSON.stringify(p); p.nutrition.zero = [];
    expect(nutritionOutput(p).perServing.trans).toBe('0.01');
    expect(nutritionOutput(p).per100.trans).toBe('待確認');
    expect(p.nutrition.per100.trans).toBe(JSON.parse(original).nutrition.per100.trans);
  });
  it('empty fields do not turn into zero', () => {
    const p = demoProduct(); p.nutrition.perServing.protein = '';
    expect(nutritionOutput(p).perServing.protein).toBe('未填');
    expect(validate(p, job, approved).some(i => i.severity === 'error' && i.rule === 'NUTRITION')).toBe(true);
  });
});
