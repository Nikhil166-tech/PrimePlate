import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription, SubscriptionStatus } from './subscription.entity';
import { User } from '../users/user.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';
import { Payment } from '../payments/payment.entity';
import { ProviderEarning } from '../payouts/provider-earning.entity';
import { MealProvider } from '../providers/meal-provider.entity';

describe('SubscriptionsService — Paid Subscription Enforcement (PrimeMate)', () => {
  let service: SubscriptionsService;
  let subRepo: jest.Mocked<Repository<Subscription>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let planRepo: jest.Mocked<Repository<MealPlan>>;
  let mockManager: any;

  const studentAId = 'student-uuid-a';
  const studentBId = 'student-uuid-b';
  const providerIdA = 'provider-uuid-a';
  const providerIdB = 'provider-uuid-b';

  beforeEach(async () => {
    mockManager = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      transaction: jest.fn(),
      count: jest.fn(),
    };

    subRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      manager: mockManager,
    } as any;

    userRepo = { findOne: jest.fn() } as any;
    planRepo = { findOne: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: getRepositoryToken(Subscription), useValue: subRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(MealPlan), useValue: planRepo },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test 1 & 9: Paid payment + active subscription -> returned to PrimeMate
  it('1 & 9. SHOULD return subscription when Payment.status = paid and Subscription.status = active with matching student/subscription', async () => {
    const mockSub = {
      id: 'sub-1',
      student: { id: studentAId },
      mealPlan: { id: 'plan-1', provider: { id: providerIdA } },
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date('2026-08-27T10:00:00Z'),
    };
    const mockEarning = {
      subscriptionId: 'sub-1',
      studentId: studentAId,
      payment: {
        id: 'pay-1',
        status: 'paid',
        amount: 1500,
        razorpayOrderId: 'order_1',
        razorpayPaymentId: 'pay_1',
        createdAt: new Date('2026-08-27T10:00:00Z'),
      },
    };

    subRepo.find.mockResolvedValue([mockSub as any]);
    mockManager.find.mockImplementation((entity: any) => {
      if (entity === ProviderEarning) return Promise.resolve([mockEarning]);
      if (entity === Payment) return Promise.resolve([mockEarning.payment]);
      return Promise.resolve([]);
    });

    const res = await service.findByStudent(studentAId);

    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('sub-1');
    expect(res[0].paymentStatus).toBe('PAID');
    expect(res[0].amountPaid).toBe(1500);
  });

  // Test 2: Failed payment + active subscription -> NOT returned
  it('2. SHOULD NOT return active subscription if Payment.status = failed', async () => {
    const mockSub = {
      id: 'sub-failed',
      student: { id: studentAId },
      mealPlan: { id: 'plan-1', provider: { id: providerIdA } },
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date(),
    };
    const mockPayment = {
      id: 'pay-failed',
      student: { id: studentAId },
      provider: { id: providerIdA },
      mealPlanId: 'plan-1',
      status: 'failed',
      amount: 1500,
      createdAt: new Date(),
    };

    subRepo.find.mockResolvedValue([mockSub as any]);
    mockManager.find.mockImplementation((entity: any) => {
      if (entity === ProviderEarning) return Promise.resolve([]);
      if (entity === Payment) return Promise.resolve([mockPayment]);
      return Promise.resolve([]);
    });

    const res = await service.findByStudent(studentAId);

    expect(res).toHaveLength(0);
  });

  // Test 3: Processing payment + active subscription -> NOT returned
  it('3. SHOULD NOT return active subscription if Payment.status = processing', async () => {
    const mockSub = {
      id: 'sub-proc',
      student: { id: studentAId },
      mealPlan: { id: 'plan-1', provider: { id: providerIdA } },
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date(),
    };
    const mockPayment = {
      id: 'pay-proc',
      student: { id: studentAId },
      provider: { id: providerIdA },
      mealPlanId: 'plan-1',
      status: 'processing',
      amount: 1500,
      createdAt: new Date(),
    };

    subRepo.find.mockResolvedValue([mockSub as any]);
    mockManager.find.mockImplementation((entity: any) => {
      if (entity === ProviderEarning) return Promise.resolve([]);
      if (entity === Payment) return Promise.resolve([mockPayment]);
      return Promise.resolve([]);
    });

    const res = await service.findByStudent(studentAId);

    expect(res).toHaveLength(0);
  });

  // Test 4: Created payment + active subscription -> NOT returned
  it('4. SHOULD NOT return active subscription if Payment.status = created', async () => {
    const mockSub = {
      id: 'sub-created',
      student: { id: studentAId },
      mealPlan: { id: 'plan-1', provider: { id: providerIdA } },
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date(),
    };
    const mockPayment = {
      id: 'pay-created',
      student: { id: studentAId },
      provider: { id: providerIdA },
      mealPlanId: 'plan-1',
      status: 'created',
      amount: 1500,
      createdAt: new Date(),
    };

    subRepo.find.mockResolvedValue([mockSub as any]);
    mockManager.find.mockImplementation((entity: any) => {
      if (entity === ProviderEarning) return Promise.resolve([]);
      if (entity === Payment) return Promise.resolve([mockPayment]);
      return Promise.resolve([]);
    });

    const res = await service.findByStudent(studentAId);

    expect(res).toHaveLength(0);
  });

  // Test 5: No payment + active subscription -> NOT returned
  it('5. SHOULD NOT return subscription if no payment record exists', async () => {
    const mockSub = {
      id: 'sub-nopay',
      student: { id: studentAId },
      mealPlan: { id: 'plan-1', provider: { id: providerIdA } },
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date(),
    };

    subRepo.find.mockResolvedValue([mockSub as any]);
    mockManager.find.mockImplementation(() => Promise.resolve([]));

    const res = await service.findByStudent(studentAId);

    expect(res).toHaveLength(0);
  });

  // Test 6: Refunded payment -> NOT returned as active paid subscription
  it('6. SHOULD NOT return subscription if Payment.status = refunded', async () => {
    const mockSub = {
      id: 'sub-refund',
      student: { id: studentAId },
      mealPlan: { id: 'plan-1', provider: { id: providerIdA } },
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date(),
    };
    const mockPayment = {
      id: 'pay-refund',
      student: { id: studentAId },
      provider: { id: providerIdA },
      mealPlanId: 'plan-1',
      status: 'refunded',
      amount: 1500,
      createdAt: new Date(),
    };

    subRepo.find.mockResolvedValue([mockSub as any]);
    mockManager.find.mockImplementation((entity: any) => {
      if (entity === ProviderEarning) return Promise.resolve([]);
      if (entity === Payment) return Promise.resolve([mockPayment]);
      return Promise.resolve([]);
    });

    const res = await service.findByStudent(studentAId);

    expect(res).toHaveLength(0);
  });

  // Test 7: Paid payment belonging to a DIFFERENT student -> NOT returned
  it('7. SHOULD NOT return subscription if paid payment belongs to a different student', async () => {
    const mockSub = {
      id: 'sub-student-a',
      student: { id: studentAId },
      mealPlan: { id: 'plan-1', provider: { id: providerIdA } },
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date('2026-08-27T10:00:00Z'),
    };
    // Payment belongs to Student B
    const mockOtherPayment = {
      id: 'pay-student-b',
      student: { id: studentBId },
      provider: { id: providerIdA },
      mealPlanId: 'plan-1',
      status: 'paid',
      amount: 1500,
      createdAt: new Date('2026-08-27T10:00:00Z'),
    };

    subRepo.find.mockResolvedValue([mockSub as any]);
    mockManager.find.mockImplementation((entity: any) => {
      if (entity === ProviderEarning) return Promise.resolve([]);
      if (entity === Payment) return Promise.resolve([mockOtherPayment]);
      return Promise.resolve([]);
    });

    const res = await service.findByStudent(studentAId);

    expect(res).toHaveLength(0);
  });

  // Test 8: Paid payment belonging to a DIFFERENT subscription -> NOT double matched
  it('8. SHOULD NOT return subscription if paid payment belongs to a different subscription', async () => {
    const mockSub1 = {
      id: 'sub-1',
      student: { id: studentAId },
      mealPlan: { id: 'plan-1', provider: { id: providerIdA } },
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date('2026-08-27T10:00:00Z'),
    };
    const mockSub2 = {
      id: 'sub-2-unpaid',
      student: { id: studentAId },
      mealPlan: { id: 'plan-1', provider: { id: providerIdA } },
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date('2026-08-27T10:01:00Z'),
    };

    const mockEarning1 = {
      subscriptionId: 'sub-1',
      studentId: studentAId,
      payment: {
        id: 'pay-1',
        status: 'paid',
        amount: 1500,
        createdAt: new Date('2026-08-27T10:00:00Z'),
      },
    };

    subRepo.find.mockResolvedValue([mockSub1 as any, mockSub2 as any]);
    mockManager.find.mockImplementation((entity: any) => {
      if (entity === ProviderEarning) return Promise.resolve([mockEarning1]);
      if (entity === Payment) return Promise.resolve([mockEarning1.payment]);
      return Promise.resolve([]);
    });

    const res = await service.findByStudent(studentAId);

    // Only sub1 should be returned, sub2 has no payment of its own
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe('sub-1');
  });

  // Test 18 & 19: Provider & Student Isolation
  it('18 & 19. SHOULD enforce student and provider isolation strictly', async () => {
    subRepo.find.mockImplementation((opts: any) => {
      if (opts?.where?.student?.id === studentAId) {
        return Promise.resolve([
          {
            id: 'sub-a',
            student: { id: studentAId },
            mealPlan: { provider: { id: providerIdA } },
            status: SubscriptionStatus.ACTIVE,
            createdAt: new Date(),
          } as any,
        ]);
      }
      return Promise.resolve([]);
    });

    mockManager.find.mockImplementation((entity: any, opts: any) => {
      if (entity === ProviderEarning && opts?.where?.studentId === studentAId) {
        return Promise.resolve([
          {
            subscriptionId: 'sub-a',
            payment: { id: 'pay-a', status: 'paid', amount: 1000 },
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const studentAResults = await service.findByStudent(studentAId);
    const studentBResults = await service.findByStudent(studentBId);

    expect(studentAResults).toHaveLength(1);
    expect(studentAResults[0].id).toBe('sub-a');
    expect(studentBResults).toHaveLength(0);
  });

  // Test 20: Historical price change integrity
  it('20. SHOULD preserve historical paid amount regardless of current meal plan price changes', async () => {
    const mockSub = {
      id: 'sub-hist',
      student: { id: studentAId },
      mealPlan: { id: 'plan-1', pricePerMonth: 3500, provider: { id: providerIdA } }, // current price 3500
      status: SubscriptionStatus.ACTIVE,
      createdAt: new Date('2026-08-01T10:00:00Z'),
    };
    const mockEarning = {
      subscriptionId: 'sub-hist',
      studentId: studentAId,
      payment: {
        id: 'pay-hist',
        status: 'paid',
        amount: 3000, // historical payment was 3000
        createdAt: new Date('2026-08-01T10:00:00Z'),
      },
    };

    subRepo.find.mockResolvedValue([mockSub as any]);
    mockManager.find.mockImplementation((entity: any) => {
      if (entity === ProviderEarning) return Promise.resolve([mockEarning]);
      if (entity === Payment) return Promise.resolve([mockEarning.payment]);
      return Promise.resolve([]);
    });

    const res = await service.findByStudent(studentAId);

    expect(res).toHaveLength(1);
    expect(res[0].amountPaid).toBe(3000); // Must remain 3000, not 3500
  });
});
