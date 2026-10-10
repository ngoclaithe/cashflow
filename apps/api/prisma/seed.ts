import { PrismaClient, CategoryType, TransactionDirection, RuleField, RuleOperator, BudgetPeriod } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data for Cashflow...');

  // 1. Create or find default user
  const email = 'admin@cashflow.local';
  const existingUser = await prisma.user.findUnique({ where: { email } });
  let user = existingUser;

  if (!user) {
    const passwordHash = await bcrypt.hash('admin123456', 10);
    user = await prisma.user.create({
      data: {
        email,
        name: 'Ngọc Lai',
        passwordHash,
      },
    });
    console.log(`Created default user: ${user.email} (id: ${user.id})`);
  } else {
    console.log(`Default user already exists: ${user.email}`);
  }

  // 2. Default categories
  const categoriesData = [
    { name: 'Tiền thuê nhà & Chỗ ở', type: CategoryType.EXPENSE, color: '#f87171', icon: 'Home' },
    { name: 'Ăn uống & Sinh hoạt', type: CategoryType.EXPENSE, color: '#fb923c', icon: 'Utensils' },
    { name: 'Đi lại & Phương tiện', type: CategoryType.EXPENSE, color: '#facc15', icon: 'Car' },
    { name: 'Tập Gym & Thể thao', type: CategoryType.EXPENSE, color: '#4ade80', icon: 'Dumbbell' },
    { name: 'Học tập & Chứng chỉ AWS', type: CategoryType.EXPENSE, color: '#60a5fa', icon: 'GraduationCap' },
    { name: 'Học bằng lái xe', type: CategoryType.EXPENSE, color: '#818cf8', icon: 'Award' },
    { name: 'Quà tặng & Xã giao', type: CategoryType.EXPENSE, color: '#f472b6', icon: 'Gift' },
    { name: 'Chi phí khác', type: CategoryType.EXPENSE, color: '#9ca3af', icon: 'MoreHorizontal' },
    { name: 'Lương hàng tháng', type: CategoryType.INCOME, color: '#34d399', icon: 'Briefcase' },
    { name: 'Thưởng Tết & Thưởng khác', type: CategoryType.INCOME, color: '#2dd4bf', icon: 'Sparkles' },
    { name: 'Thu nhập khác', type: CategoryType.INCOME, color: '#a78bfa', icon: 'Coins' },
    { name: 'Chuyển khoản nội bộ', type: CategoryType.TRANSFER, color: '#94a3b8', icon: 'ArrowLeftRight' },
  ];

  const categoryMap = new Map<string, string>();
  for (const cat of categoriesData) {
    const record = await prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: cat.name } },
      update: {},
      create: {
        userId: user.id,
        name: cat.name,
        type: cat.type,
        color: cat.color,
        icon: cat.icon,
        isSystem: true,
      },
    });
    categoryMap.set(cat.name, record.id);
  }

  // 3. Categorization rules
  const rulesData = [
    { name: 'Nhận lương', field: RuleField.DESCRIPTION, operator: RuleOperator.CONTAINS, value: 'LUONG', categoryName: 'Lương hàng tháng', priority: 100 },
    { name: 'Thưởng Tết', field: RuleField.DESCRIPTION, operator: RuleOperator.CONTAINS, value: 'THUONG TET', categoryName: 'Thưởng Tết & Thưởng khác', priority: 90 },
    { name: 'Tiền nhà', field: RuleField.DESCRIPTION, operator: RuleOperator.CONTAINS, value: 'TIEN NHA', categoryName: 'Tiền thuê nhà & Chỗ ở', priority: 80 },
    { name: 'Tiền thuê trọ', field: RuleField.DESCRIPTION, operator: RuleOperator.CONTAINS, value: 'THUE NHA', categoryName: 'Tiền thuê nhà & Chỗ ở', priority: 80 },
    { name: 'Tập Gym', field: RuleField.DESCRIPTION, operator: RuleOperator.CONTAINS, value: 'GYM', categoryName: 'Tập Gym & Thể thao', priority: 70 },
    { name: 'Học lái xe', field: RuleField.DESCRIPTION, operator: RuleOperator.CONTAINS, value: 'LAI XE', categoryName: 'Học bằng lái xe', priority: 70 },
    { name: 'Lệ phí thi AWS', field: RuleField.DESCRIPTION, operator: RuleOperator.CONTAINS, value: 'AWS', categoryName: 'Học tập & Chứng chỉ AWS', priority: 70 },
    { name: 'GrabFood', field: RuleField.DESCRIPTION, operator: RuleOperator.CONTAINS, value: 'GRABFOOD', categoryName: 'Ăn uống & Sinh hoạt', priority: 50 },
    { name: 'ShopeeFood', field: RuleField.DESCRIPTION, operator: RuleOperator.CONTAINS, value: 'SHOPEEFOOD', categoryName: 'Ăn uống & Sinh hoạt', priority: 50 },
  ];

  for (const rule of rulesData) {
    const categoryId = categoryMap.get(rule.categoryName);
    if (!categoryId) continue;

    const existingRule = await prisma.categorizationRule.findFirst({
      where: { userId: user.id, name: rule.name },
    });
    if (!existingRule) {
      await prisma.categorizationRule.create({
        data: {
          userId: user.id,
          name: rule.name,
          priority: rule.priority,
          field: rule.field,
          operator: rule.operator,
          value: rule.value,
          categoryId,
        },
      });
    }
  }

  // 4. Default MB Bank Account
  const defaultAccount = await prisma.account.upsert({
    where: {
      userId_provider_accountNumber: {
        userId: user.id,
        provider: 'MBBANK',
        accountNumber: '1468651509999',
      },
    },
    update: {
      accountNumber: '1468651509999',
      displayName: 'MB Bank (1468651509999)',
    },
    create: {
      userId: user.id,
      provider: 'MBBANK',
      bankName: 'MB Bank',
      accountNumber: '1468651509999',
      displayName: 'MB Bank (1468651509999)',
      balance: 18000000,
      currency: 'VND',
    },
  });

  // 5. Initial Editable Budgets
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const initialBudgets = [
    { name: 'Chi tiêu sinh hoạt', amount: 3560000, categoryName: 'Ăn uống & Sinh hoạt' },
    { name: 'Tập Gym', amount: 500000, categoryName: 'Tập Gym & Thể thao' },
    { name: 'Quà tặng & Xã giao', amount: 500000, categoryName: 'Quà tặng & Xã giao' },
    { name: 'Thi chứng chỉ AWS DEA-C01', amount: 4000000, categoryName: 'Học tập & Chứng chỉ AWS' },
    { name: 'Học bằng lái xe', amount: 20000000, categoryName: 'Học bằng lái xe' },
  ];

  for (const b of initialBudgets) {
    const categoryId = categoryMap.get(b.categoryName);
    const existing = await prisma.budget.findFirst({
      where: { userId: user.id, name: b.name },
    });
    if (!existing) {
      await prisma.budget.create({
        data: {
          userId: user.id,
          name: b.name,
          amount: b.amount,
          categoryId,
          period: BudgetPeriod.MONTHLY,
          startDate: startOfMonth,
        },
      });
    }
  }

  // 6. Recurring Transactions
  const recurringData = [
    {
      name: 'Tiền thuê nhà định kỳ',
      amount: 7000000,
      direction: TransactionDirection.EXPENSE,
      dayOfMonth: 5,
      dueDateDescription: 'Trước ngày 5 hàng tháng',
      isObligation: true,
      categoryName: 'Tiền thuê nhà & Chỗ ở',
    },
    {
      name: 'Lương công ty',
      amount: 20300000,
      direction: TransactionDirection.INCOME,
      dayOfMonth: 10,
      dueDateDescription: 'Ngày 10 hàng tháng',
      isObligation: false,
      categoryName: 'Lương hàng tháng',
    },
  ];

  for (const r of recurringData) {
    const categoryId = categoryMap.get(r.categoryName);
    const existing = await prisma.recurringTransaction.findFirst({
      where: { userId: user.id, name: r.name },
    });
    if (!existing) {
      await prisma.recurringTransaction.create({
        data: {
          userId: user.id,
          name: r.name,
          amount: r.amount,
          direction: r.direction,
          dayOfMonth: r.dayOfMonth,
          dueDateDescription: r.dueDateDescription,
          isObligation: r.isObligation,
          categoryId,
        },
      });
    }
  }

  // 7. Savings Goal
  const existingGoal = await prisma.savingsGoal.findFirst({
    where: { userId: user.id, name: 'Mục tiêu tích lũy cá nhân' },
  });
  if (!existingGoal) {
    await prisma.savingsGoal.create({
      data: {
        userId: user.id,
        name: 'Mục tiêu tích lũy cá nhân',
        targetAmount: 60000000,
        targetDate: new Date('2027-03-10T00:00:00.000Z'),
        currentAmount: 18000000,
      },
    });
  }

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
