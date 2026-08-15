/**
 * @jest-environment node
 *
 * Artemis B10 — strict titangold-json-c14n-1 canonicalization tests (no DB).
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import {
  CANONICALIZATION_VERSION,
  CanonicalizationError,
  buildCanonicalDecisionPayload,
  canonicalizeToJsonString,
  isWithinDecisionByteLimit,
  strictNormalize,
  MAX_DECISION_UTF8_BYTES,
} from '../../services/artemisDecisionCanonicalJson.js';

const GOLDEN_INPUT = {
  z: 1,
  a: { c: 3, b: 2 },
  arr: [1, 2, 3],
  u: 'سلام',
  n: -0,
};
const GOLDEN_UTF8 = '{"a":{"b":2,"c":3},"arr":[1,2,3],"n":0,"u":"سلام","z":1}';
const GOLDEN_SHA256 = createHash('sha256').update(GOLDEN_UTF8, 'utf8').digest('hex');

describe('B10 titangold-json-c14n-1', () => {
  it('exports frozen canonicalization version', () => {
    expect(CANONICALIZATION_VERSION).toBe('titangold-json-c14n-1');
  });

  it('sorts nested keys deterministically and retains array order', () => {
    const left = canonicalizeToJsonString({ z: 1, a: { c: 3, b: 2 }, arr: [3, 1, 2] });
    const right = canonicalizeToJsonString({ arr: [3, 1, 2], a: { b: 2, c: 3 }, z: 1 });
    expect(left).toBe(right);
    expect(left).toBe('{"a":{"b":2,"c":3},"arr":[3,1,2],"z":1}');
  });

  it('Unicode is deterministic UTF-8', () => {
    expect(canonicalizeToJsonString({ u: 'سلام' })).toBe('{"u":"سلام"}');
  });

  it('normalizes -0 explicitly to 0', () => {
    expect(Object.is(strictNormalize(-0), 0)).toBe(true);
    expect(canonicalizeToJsonString({ n: -0 })).toBe('{"n":0}');
  });

  it('golden vector locks string, hash, and version', () => {
    const built = buildCanonicalDecisionPayload(GOLDEN_INPUT);
    expect(built.canonicalizationVersion).toBe(CANONICALIZATION_VERSION);
    expect(built.canonicalUtf8).toBe(GOLDEN_UTF8);
    expect(built.payloadSha256).toBe(GOLDEN_SHA256);
    expect(built.payloadBytes).toBe(Buffer.byteLength(GOLDEN_UTF8, 'utf8'));
    expect(built.canonicalObject).toEqual(JSON.parse(GOLDEN_UTF8));
  });

  it('enforces payload byte limit helper at 16384', () => {
    expect(MAX_DECISION_UTF8_BYTES).toBe(16384);
    expect(isWithinDecisionByteLimit(1)).toBe(true);
    expect(isWithinDecisionByteLimit(16384)).toBe(true);
    expect(isWithinDecisionByteLimit(16385)).toBe(false);
    expect(isWithinDecisionByteLimit(0)).toBe(false);
  });

  it.each([
    ['undefined', undefined, 'UNSUPPORTED_UNDEFINED'],
    ['function', () => 1, 'UNSUPPORTED_FUNCTION'],
    ['symbol', Symbol('x'), 'UNSUPPORTED_SYMBOL'],
    ['bigint', 1n, 'UNSUPPORTED_BIGINT'],
    ['NaN', Number.NaN, 'UNSUPPORTED_NAN'],
    ['Infinity', Number.POSITIVE_INFINITY, 'UNSUPPORTED_INFINITY'],
    ['-Infinity', Number.NEGATIVE_INFINITY, 'UNSUPPORTED_INFINITY'],
    ['Date', new Date('2026-01-01T00:00:00.000Z'), 'UNSUPPORTED_DATE'],
    ['Buffer', Buffer.from('x'), 'UNSUPPORTED_BUFFER'],
    ['typed array', new Uint8Array([1]), 'UNSUPPORTED_TYPED_ARRAY'],
    ['Map', new Map([['a', 1]]), 'UNSUPPORTED_MAP'],
    ['Set', new Set([1]), 'UNSUPPORTED_SET'],
  ])('rejects %s', (_label, value, code) => {
    expect(() => strictNormalize(value)).toThrow(CanonicalizationError);
    try {
      strictNormalize(value);
    } catch (err) {
      expect(err.code).toBe(code);
    }
  });

  it('rejects class instances', () => {
    class Foo { constructor() { this.a = 1; } }
    expect(() => strictNormalize(new Foo())).toThrow(/non-plain object/);
  });

  it('rejects symbol-keyed properties', () => {
    const obj = { a: 1 };
    obj[Symbol('s')] = 2;
    expect(() => strictNormalize(obj)).toThrow(/symbol-keyed/);
  });

  it('rejects accessor properties', () => {
    const obj = {};
    Object.defineProperty(obj, 'a', {
      enumerable: true,
      get() { return 1; },
    });
    expect(() => strictNormalize(obj)).toThrow(/accessor/);
  });

  it('rejects sparse arrays', () => {
    // eslint-disable-next-line no-sparse-arrays
    const sparse = [1, , 3];
    expect(() => strictNormalize(sparse)).toThrow(/sparse array/);
  });

  it('rejects unsupported non-enumerable own data', () => {
    const obj = { a: 1 };
    Object.defineProperty(obj, 'hidden', {
      value: 2,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    expect(() => strictNormalize(obj)).toThrow(/non-enumerable/);
  });

  it('buildCanonicalDecisionPayload rejects arrays/non-objects', () => {
    expect(() => buildCanonicalDecisionPayload([])).toThrow(CanonicalizationError);
    expect(() => buildCanonicalDecisionPayload(null)).toThrow(CanonicalizationError);
  });

  it('rejects custom own properties on arrays (enumerable)', () => {
    const a = [1, 2];
    a.foo = 3;
    expect(() => strictNormalize(a)).toThrow(CanonicalizationError);
    try {
      strictNormalize(a);
    } catch (err) {
      expect(err.code).toBe('UNSUPPORTED_ARRAY_PROPERTY');
    }
  });

  it('rejects custom non-enumerable own properties on arrays', () => {
    const a = [1, 2];
    Object.defineProperty(a, 'meta', {
      value: 9,
      enumerable: false,
      writable: true,
      configurable: true,
    });
    expect(() => strictNormalize(a)).toThrow(CanonicalizationError);
    try {
      strictNormalize(a);
    } catch (err) {
      expect(err.code).toBe('UNSUPPORTED_ARRAY_PROPERTY');
    }
  });

  it('preserves __proto__ JSON data key without Object.prototype pollution', () => {
    const input = JSON.parse('{"__proto__":{"polluted":true},"a":1}');
    const utf8 = canonicalizeToJsonString(input);
    expect(utf8).toContain('"__proto__"');
    expect(utf8).toBe('{"__proto__":{"polluted":true},"a":1}');
    const rebuilt = JSON.parse(utf8);
    expect(Object.prototype.hasOwnProperty.call(rebuilt, '__proto__')).toBe(true);
    expect(Object.getOwnPropertyDescriptor(rebuilt, '__proto__').value).toEqual({ polluted: true });
    expect(Object.prototype.polluted).toBeUndefined();
    const built = buildCanonicalDecisionPayload(input);
    expect(built.canonicalUtf8).toContain('"__proto__"');
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it('orders integer-like object keys lexicographically', () => {
    expect(canonicalizeToJsonString({ 10: 'x', 2: 'y' })).toBe('{"10":"x","2":"y"}');
    expect(canonicalizeToJsonString({ 2: 'y', 10: 'x' })).toBe('{"10":"x","2":"y"}');
  });

  it('rejects self-cycle with CIRCULAR_REFERENCE', () => {
    const o = { a: 1 };
    o.self = o;
    expect(() => strictNormalize(o)).toThrow(CanonicalizationError);
    try {
      strictNormalize(o);
    } catch (err) {
      expect(err.code).toBe('CIRCULAR_REFERENCE');
    }
  });

  it('rejects mutual A↔B cycle with CIRCULAR_REFERENCE', () => {
    const a = { name: 'a' };
    const b = { name: 'b' };
    a.b = b;
    b.a = a;
    expect(() => strictNormalize(a)).toThrow(CanonicalizationError);
    try {
      strictNormalize(a);
    } catch (err) {
      expect(err.code).toBe('CIRCULAR_REFERENCE');
    }
  });

  it('allows shared non-cyclic child referenced twice', () => {
    const child = { v: 1 };
    const parent = { left: child, right: child };
    expect(canonicalizeToJsonString(parent)).toBe('{"left":{"v":1},"right":{"v":1}}');
  });
});
