import Decimal from 'decimal.js';

export class DecimalHelper {
  static toDecimal(val: number | string | Decimal | null | undefined): Decimal {
    if (val === null || val === undefined) return new Decimal(0);
    return new Decimal(val);
  }

  static toNumber(val: number | string | Decimal | null | undefined): number {
    if (val === null || val === undefined) return 0;
    return new Decimal(val).toNumber();
  }

  static add(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).plus(new Decimal(b));
  }

  static subtract(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).minus(new Decimal(b));
  }

  static multiply(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    return new Decimal(a).times(new Decimal(b));
  }

  static divide(a: number | string | Decimal, b: number | string | Decimal): Decimal {
    const divisor = new Decimal(b);
    if (divisor.isZero()) return new Decimal(0);
    return new Decimal(a).dividedBy(divisor);
  }

  static isGreaterThan(a: number | string | Decimal, b: number | string | Decimal): boolean {
    return new Decimal(a).greaterThan(new Decimal(b));
  }

  static isLessThan(a: number | string | Decimal, b: number | string | Decimal): boolean {
    return new Decimal(a).lessThan(new Decimal(b));
  }
}
