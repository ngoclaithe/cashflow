import { DecimalHelper } from './decimal.helper';
import Decimal from 'decimal.js';

describe('DecimalHelper', () => {
  it('should accurately add monetary values without IEEE-754 floating point errors', () => {
    // 0.1 + 0.2 in JS is 0.30000000000000004
    const res = DecimalHelper.add(0.1, 0.2);
    expect(res.toNumber()).toBe(0.3);
  });

  it('should accurately subtract monetary values', () => {
    const res = DecimalHelper.subtract(10000000, 3560000);
    expect(res.toNumber()).toBe(6440000);
  });

  it('should calculate budget percentage accurately', () => {
    const spent = 3560000;
    const limit = 7000000;
    const ratio = DecimalHelper.divide(spent, limit).times(100);
    expect(ratio.toFixed(2)).toBe('50.86');
  });

  it('should handle division by zero gracefully without throwing', () => {
    const res = DecimalHelper.divide(500000, 0);
    expect(res.toNumber()).toBe(0);
  });
});
