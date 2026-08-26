import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AnalyticsService } from './analytics.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Payment } from '../payments/payment.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/subscription.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { User } from '../users/user.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';

describe('Revenue Integrity Specification & Price-Change Isolation', () => {
  let analyticsService: AnalyticsService;
  let subscriptionsService: SubscriptionsService;
  let paymentRepo: Repository<Payment>;
  let subRepo: Repository<Subscription>;
  let providerRepo: Repository<MealProvider>;
  let planRepo: Repository<MealPlan>;

  const mockUserStudent1: any = { id: 'student-1', role: 'STUDENT', name: 'Student One' };
  const mockUserStudent2: any = { id: 'student-2', role: 'STUDENT', name: 'Student Two' };

  const mockProviderA: any = {
    id: 'provider-A',
    name: 'Provider A Mess',
    monthlyPrice: 3000,
    approvalStatus: 'APPROVED',
  };

  const mockProviderB: any = {
    id: 'provider-B',
    name: 'Provider B Mess',
    monthlyPrice: 2500,
    approvalStatus: 'APPROVED',
  };

  const mockPlanA: any = {
    id: 'plan-A',
    title: '1 Month Plan A',
    pricePerMonth: 3000,
    provider: mockProviderA,
  };

  const mockPlanB: any = {
    id: 'plan-B',
    title: '1 Month Plan B',
    pricePerMonth: 2500,
    provider: mockProviderB,
  };

  let mockPayments: any[] = [];
  let mockSubscriptions: any[] = [];

  beforeEach(async () => {
    mockPayments = [
      {
        id: 'pay-1',
        amount: 3000,
        status: 'paid',
        student: mockUserStudent1,
        provider: mockProviderA,
        createdAt: new Date('2026-08-01'),
      },
    ];

    mockSubscriptions = [
      {
        id: 'sub-1',
        student: mockUserStudent1,
        mealPlan: mockPlanA,
        status: SubscriptionStatus.ACTIVE,
        startDate: '2026-08-01',
        endDate: '2026-08-30',
        createdAt: new Date('2026-08-01'),
      },
      {
        id: 'sub-B1',
        student: mockUserStudent2,
        mealPlan: mockPlanB,
        status: SubscriptionStatus.ACTIVE,
        startDate: '2026-08-01',
        endDate: '2026-08-30',
        createdAt: new Date('2026-08-01'),
      },
    ];


    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        SubscriptionsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            find: jest.fn().mockImplementation((opts) => {
              let res = [...mockPayments];
              if (opts?.where?.status) {
                res = res.filter((p) => p.status === opts.where.status);
              }
              if (opts?.where?.provider?.id) {
                res = res.filter((p) => p.provider?.id === opts.where.provider.id);
              }
              if (opts?.where?.student?.id) {
                res = res.filter((p) => p.student?.id === opts.where.student.id);
              }
              return Promise.resolve(res);
            }),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockImplementation(() => {
                const paidSum = mockPayments
                  .filter((p) => p.status === 'paid')
                  .reduce((sum, p) => sum + Number(p.amount), 0);
                return Promise.resolve({ total: paidSum });
              }),
            }),
          },
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            find: jest.fn().mockImplementation((opts) => {
              let res = [...mockSubscriptions];
              if (opts?.where?.mealPlan?.provider?.id) {
                res = res.filter(
                  (s) => s.mealPlan?.provider?.id === opts.where.mealPlan.provider.id,
                );
              }
              return Promise.resolve(res);
            }),
            manager: {
              find: jest.fn().mockImplementation((entity, opts) => {
                if (entity === Payment) {
                  let res = [...mockPayments];
                  if (opts?.where?.provider?.id) {
                    res = res.filter((p) => p.provider?.id === opts.where.provider.id);
                  }
                  if (opts?.where?.status) {
                    res = res.filter((p) => p.status === opts.where.status);
                  }
                  return Promise.resolve(res);
                }
                return Promise.resolve([]);
              }),
            },
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { count: jest.fn().mockResolvedValue(2) },
        },
        {
          provide: getRepositoryToken(MealProvider),
          useValue: { count: jest.fn().mockResolvedValue(2) },
        },
        {
          provide: getRepositoryToken(MealPlan),
          useValue: { findOne: jest.fn().mockResolvedValue(mockPlanA) },
        },
      ],
    }).compile();

    analyticsService = module.get<AnalyticsService>(AnalyticsService);
    subscriptionsService = module.get<SubscriptionsService>(SubscriptionsService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    subRepo = module.get(getRepositoryToken(Subscription));
    providerRepo = module.get(getRepositoryToken(MealProvider));
    planRepo = module.get(getRepositoryToken(MealPlan));
  });

  it('1. Initial historical revenue equals sum of verified paid payment amounts (₹3,000)', async () => {
    const rev = await analyticsService.getTotalRevenue();
    expect(rev).toBe(3000);
  });

  it('2. Changing provider price to ₹3,500 does NOT retroactively change historical revenue (remains ₹3,000)', async () => {
    // Provider changes current price to 3,500
    mockProviderA.monthlyPrice = 3500;
    mockPlanA.pricePerMonth = 3500;

    const rev = await analyticsService.getTotalRevenue();
    expect(rev).toBe(3000);

    const providerSubs = await subscriptionsService.findByProvider('provider-A');
    expect(providerSubs.length).toBe(1);
    expect(providerSubs[0].amountPaid).toBe(3000);
  });

  it('3. Creating a new verified payment of ₹3,500 updates total revenue to ₹6,500', async () => {
    mockPayments.push({
      id: 'pay-2',
      amount: 3500,
      status: 'paid',
      student: mockUserStudent2,
      provider: mockProviderA,
      createdAt: new Date('2026-08-15'),
    });

    mockSubscriptions.push({
      id: 'sub-2',
      student: mockUserStudent2,
      mealPlan: mockPlanA,
      status: SubscriptionStatus.ACTIVE,
      startDate: '2026-08-15',
      endDate: '2026-09-15',
      createdAt: new Date('2026-08-15'),
    });

    const rev = await analyticsService.getTotalRevenue();
    expect(rev).toBe(6500);

    const providerSubs = await subscriptionsService.findByProvider('provider-A');
    expect(providerSubs[0].amountPaid).toBe(3000); // Historical payment 1 preserved
    expect(providerSubs[1].amountPaid).toBe(3500); // New payment 2 at ₹3,500
  });

  it('4. Historical payment amounts retain original agreed values (₹3,000)', async () => {
    const providerSubs = await subscriptionsService.findByProvider('provider-A');
    expect(providerSubs[0].amountPaid).toBe(3000);
  });

  it('5. Failed or unverified payments do NOT increase realized revenue', async () => {
    mockPayments.push({
      id: 'pay-failed',
      amount: 3500,
      status: 'failed',
      student: mockUserStudent2,
      provider: mockProviderA,
    });

    const rev = await analyticsService.getTotalRevenue();
    expect(rev).toBe(3000); // Excludes failed payment
  });

  it('6. Provider A price changes do NOT alter Provider B historical revenue', async () => {
    mockPayments.push({
      id: 'pay-B1',
      amount: 2500,
      status: 'paid',
      student: mockUserStudent2,
      provider: mockProviderB,
    });

    // Provider A changes price to ₹4,000
    mockProviderA.monthlyPrice = 4000;

    const providerBSubs = await subscriptionsService.findByProvider('provider-B');
    expect(providerBSubs.length).toBe(1);
    expect(providerBSubs[0].amountPaid).toBe(2500);
  });

  it('7. Multiple price updates (₹3,000 -> ₹3,500 -> ₹4,000) preserve original transaction amounts', async () => {
    mockProviderA.monthlyPrice = 3500;
    mockProviderA.monthlyPrice = 4000;

    const providerSubs = await subscriptionsService.findByProvider('provider-A');
    expect(providerSubs[0].amountPaid).toBe(3000);
  });

  it('8. Current plan price is NEVER used to reconstruct historical payment amounts', async () => {
    mockPlanA.pricePerMonth = 9999;
    const providerSubs = await subscriptionsService.findByProvider('provider-A');
    expect(providerSubs[0].amountPaid).toBe(3000);
  });
});
