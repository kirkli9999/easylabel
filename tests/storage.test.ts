import { describe, it, expect } from 'vitest';
import { demoProduct, DEFAULT_PAPER } from '../src/domain/model';
import { importProducts, makeBackup, parseBackup } from '../src/domain/storage';
describe('backups', () => {
  it('roundtrips original decimal strings without loss', () => {
    const p = demoProduct();
    p.nutrition.per100.protein = '0.5000000001';
    const parsed = parseBackup(JSON.stringify(makeBackup([p], DEFAULT_PAPER)));
    expect(parsed.products[0]).toEqual(p);
  });
  it('imports as new IDs, retains existing products, clears confirmations', () => {
    const p = demoProduct(),
      result = importProducts(JSON.stringify(makeBackup([p], DEFAULT_PAPER)), [p]);
    expect(result[0]).toEqual(p);
    expect(result[1].id).not.toBe(p.id);
    expect(result[1].allergenConfirmed).toBe(false);
    expect(result[1].nutrition.confirmed).toBe(false);
    expect(result[1].ingredients.every((i) => !i.verified)).toBe(true);
  });
  it('rejects malformed, future, oversized or missing fields atomically', () => {
    expect(() => parseBackup('{bad')).toThrow();
    expect(() =>
      parseBackup(JSON.stringify({ ...makeBackup([], DEFAULT_PAPER), schemaVersion: 2 })),
    ).toThrow();
    expect(() => parseBackup(' '.repeat(2_000_001))).toThrow();
    const broken = makeBackup([demoProduct()], DEFAULT_PAPER);
    (broken.products[0] as unknown as { allergens: null }).allergens = null;
    expect(() => parseBackup(JSON.stringify(broken))).toThrow();
  });
  it('rejects prototype and unknown keys', () => {
    const obj = JSON.stringify(makeBackup([], DEFAULT_PAPER)).replace(
      '"schemaVersion":1',
      '"__proto__":{"polluted":true},"schemaVersion":1',
    );
    expect(() => parseBackup(obj)).toThrow();
  });
});
