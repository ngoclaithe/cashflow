import { CategorizationRulesService } from './categorization-rules.service';
import { RuleField, RuleOperator } from '@prisma/client';

describe('CategorizationRulesService Rule Matching', () => {
  let service: CategorizationRulesService;

  beforeEach(() => {
    service = new CategorizationRulesService(null as any);
  });

  it('should match transaction description containing keyword case-insensitively', () => {
    const rule = {
      field: RuleField.DESCRIPTION,
      operator: RuleOperator.CONTAINS,
      value: 'TIEN NHA',
    };

    const isMatch = service.isRuleMatch(rule, {
      description: 'Chuyen tien nha thang 10',
      amount: 7000000,
    });

    expect(isMatch).toBe(true);
  });

  it('should match salary transaction correctly', () => {
    const rule = {
      field: RuleField.DESCRIPTION,
      operator: RuleOperator.CONTAINS,
      value: 'LUONG',
    };

    const isMatch = service.isRuleMatch(rule, {
      description: 'CTY ABC THANH TOAN TIEN LUONG T10',
      amount: 20300000,
    });

    expect(isMatch).toBe(true);
  });

  it('should not match unrelated transactions', () => {
    const rule = {
      field: RuleField.DESCRIPTION,
      operator: RuleOperator.CONTAINS,
      value: 'GYM',
    };

    const isMatch = service.isRuleMatch(rule, {
      description: 'Mua sach lap trinh',
      amount: 250000,
    });

    expect(isMatch).toBe(false);
  });

  it('should support regex matching safely', () => {
    const rule = {
      field: RuleField.DESCRIPTION,
      operator: RuleOperator.REGEX,
      value: 'GRAB(FOOD)?',
    };

    expect(
      service.isRuleMatch(rule, {
        description: 'Thanh toan GRABFOOD bua trua',
        amount: 85000,
      }),
    ).toBe(true);

    expect(
      service.isRuleMatch(rule, {
        description: 'Chuyen khoan binh thuong',
        amount: 50000,
      }),
    ).toBe(false);
  });
});
