import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { MealPlansService } from './meal-plans.service';
import { MealPlan, MealType } from './meal-plan.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { calculateAuthoritativeAmount } from '../payments/payments.service';
import { MealRecoveryService } from '../meal-recovery/meal-recovery.service';
import { MealRecovery } from '../meal-recovery/meal-recovery.entity';
import { MealUsage } from '../meal-usage/meal-usage.entity';
import { MealUsageAudit } from '../meal-usage/meal-usage-audit.entity';
import { User } from '../users/user.entity';
import { DataSource } from 'typeorm';
import { Subscription, SubscriptionStatus } from '../subscriptions/subscription.entity';
import { MealUsageService } from '../meal-usage/meal-usage.service';

describe('PrimePlate — Meal Type & Custom 1-Day Pricing Specification', () => {
  let mealPlansService: MealPlansService;
  let planRepo: any;
  let providerRepo: any;
  const mockMealPlans: any[] = [];

  const mockProvider = {
    id: 'prov-mess-1',
    name: 'Gourmet Mess',
    monthlyPrice: 3000,
    approvalStatus: 'APPROVED',
    acceptingSubscriptions: true,
    totalCapacity: 100,
    user: { id: 'owner-1', email: 'owner@mess.com' },
  };

  beforeEach(async () => {
    mockMealPlans.length = 0;

    planRepo = {
      create: jest.fn((dto) => ({
        id: 'plan-' + Math.random().toString(36).substring(2, 8),
        ...dto,
      })),
      save: jest.fn(async (entity) => {
        const idx = mockMealPlans.findIndex((p) => p.id === entity.id);
        if (idx >= 0) {
          mockMealPlans[idx] = { ...mockMealPlans[idx], ...entity };
          return mockMealPlans[idx];
        }
        mockMealPlans.push(entity);
        return entity;
      }),
      findOne: jest.fn(async ({ where }) => {
        return mockMealPlans.find((p) => p.id === where.id) || null;
      }),
      find: jest.fn(async ({ where }) => {
        return mockMealPlans.filter((p) => {
          if (where.provider?.id) {
            return p.provider?.id === where.provider.id;
          }
          return true;
        });
      }),
    };

    providerRepo = {
      findOne: jest.fn(async ({ where }) => {
        if (where.id === mockProvider.id) return mockProvider;
        return null;
      }),
      save: jest.fn(async (p) => p),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealPlansService,
        {
          provide: getRepositoryToken(MealPlan),
          useValue: planRepo,
        },
        {
          provide: getRepositoryToken(MealProvider),
          useValue: providerRepo,
        },
      ],
    }).compile();

    mealPlansService = module.get<MealPlansService>(MealPlansService);
  });

  describe('1. Meal Types Creation & Independent Pricing', () => {
    it('creates Full Day, Lunch Only, and Dinner Only plans with custom 1-day prices', async () => {
      const fullDay = await mealPlansService.create(mockProvider.user.id, {
        providerId: mockProvider.id,
        title: 'Full Day Plan',
        mealType: MealType.FULL_DAY,
        originalPrice: 2700,
        sellingPrice: 2500,
        customOneDayPrice: 99,
        isActive: true,
      });
      expect(fullDay.mealType).toBe(MealType.FULL_DAY);
      expect(fullDay.sellingPrice).toBe(2500);
      expect(fullDay.customOneDayPrice).toBe(99);

      const lunchOnly = await mealPlansService.create(mockProvider.user.id, {
        providerId: mockProvider.id,
        title: 'Lunch Only Plan',
        mealType: MealType.LUNCH_ONLY,
        originalPrice: 1800,
        sellingPrice: 1600,
        customOneDayPrice: 65,
        isActive: true,
      });
      expect(lunchOnly.mealType).toBe(MealType.LUNCH_ONLY);
      expect(lunchOnly.sellingPrice).toBe(1600);
      expect(lunchOnly.customOneDayPrice).toBe(65);

      const dinnerOnly = await mealPlansService.create(mockProvider.user.id, {
        providerId: mockProvider.id,
        title: 'Dinner Only Plan',
        mealType: MealType.DINNER_ONLY,
        originalPrice: 1800,
        sellingPrice: 1600,
        customOneDayPrice: 65,
        isActive: true,
      });
      expect(dinnerOnly.mealType).toBe(MealType.DINNER_ONLY);
      expect(dinnerOnly.sellingPrice).toBe(1600);
      expect(dinnerOnly.customOneDayPrice).toBe(65);

      // Verify all 3 meal plans exist independently for the provider
      const plans = await mealPlansService.findByProvider(mockProvider.id, true);
      expect(plans.length).toBe(3);
      expect(plans.map((p) => p.mealType).sort()).toEqual([MealType.DINNER_ONLY, MealType.FULL_DAY, MealType.LUNCH_ONLY]);
    });

    it('defaults mealType to FULL_DAY if not specified', async () => {
      const plan = await mealPlansService.create(mockProvider.user.id, {
        providerId: mockProvider.id,
        title: 'Legacy Style Plan',
        originalPrice: 3000,
        sellingPrice: 2800,
        customOneDayPrice: 110,
        isActive: true,
      });
      expect(plan.mealType).toBe(MealType.FULL_DAY);
    });

    it('rejects customOneDayPrice <= 0', async () => {
      await expect(
        mealPlansService.create(mockProvider.user.id, {
          providerId: mockProvider.id,
          title: 'Invalid Plan',
          originalPrice: 3000,
          sellingPrice: 2800,
          customOneDayPrice: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Custom 1-Day Pricing & Duration Calculation', () => {
    it('uses customOneDayPrice for durationDays === 1 (NOT monthlyPrice / 30)', () => {
      // Monthly 2500 / 30 = 83.33 -> round is 83. But custom 1-day is 99.
      const amount1Day = calculateAuthoritativeAmount(2500, 1, 99);
      expect(amount1Day).toBe(99);

      // Lunch 1600 / 30 = 53.33 -> round is 53. But custom 1-day is 65.
      const lunch1Day = calculateAuthoritativeAmount(1600, 1, 65);
      expect(lunch1Day).toBe(65);
    });

    it('calculates duration 7, 15, 30 using standard monthly prorating formula', () => {
      // 7 days of 2500: round(2500 * 7 / 30) = round(583.33) = 583
      expect(calculateAuthoritativeAmount(2500, 7, 99)).toBe(583);

      // 15 days of 2500: round(2500 * 15 / 30) = 1250
      expect(calculateAuthoritativeAmount(2500, 15, 99)).toBe(1250);

      // 30 days of 2500: 2500
      expect(calculateAuthoritativeAmount(2500, 30, 99)).toBe(2500);
    });

    it('rejects duration 1 if customOneDayPrice is missing or not configured', () => {
      expect(() => calculateAuthoritativeAmount(2500, 1, undefined)).toThrow(BadRequestException);
      expect(() => calculateAuthoritativeAmount(2500, 1, null)).toThrow(BadRequestException);
      expect(() => calculateAuthoritativeAmount(2500, 1, 0)).toThrow(BadRequestException);
    });
  });

  describe('3. Meal Recovery Scoping (FULL_DAY ONLY)', () => {
    let mealRecoveryService: MealRecoveryService;
    let recoveryRepo: any;
    let usageRepo: any;
    let subRepo: any;

    beforeEach(async () => {
      recoveryRepo = {
        findOne: jest.fn(),
        create: jest.fn((dto) => dto),
        save: jest.fn(async (e) => e),
      };
      usageRepo = {
        find: jest.fn().mockResolvedValue([]),
      };
      subRepo = {
        findOne: jest.fn(),
        save: jest.fn(async (s) => s),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MealRecoveryService,
          { provide: getRepositoryToken(MealRecovery), useValue: recoveryRepo },
          { provide: getRepositoryToken(MealProvider), useValue: { findOne: jest.fn().mockResolvedValue({ id: 'prov-1', recoveryPercentage: 80 }) } },
          { provide: getRepositoryToken(MealUsage), useValue: usageRepo },
          { provide: getRepositoryToken(Subscription), useValue: subRepo },
        ],
      }).compile();

      mealRecoveryService = module.get<MealRecoveryService>(MealRecoveryService);
    });

    it('gracefully skips meal recovery processing for LUNCH_ONLY subscription without creating records', async () => {
      const lunchSub = {
        id: 'sub-lunch',
        status: 'EXPIRED',
        startDate: '2026-08-01',
        endDate: '2026-08-30',
        student: { id: 'stud-1', email: 'stud@test.com' },
        provider: { id: 'prov-1' },
        mealPlan: { id: 'plan-lunch', mealType: MealType.LUNCH_ONLY, provider: { id: 'prov-1', recoveryPercentage: 80 } },
      };
      subRepo.findOne.mockResolvedValue(lunchSub);

      const result = await mealRecoveryService.processSubscriptionRecovery('sub-lunch');
      expect(result.processed).toBe(false);
      expect(result.recovery).toBeNull();
      expect(recoveryRepo.save).not.toHaveBeenCalled();
    });

    it('gracefully skips meal recovery processing for DINNER_ONLY subscription without creating records', async () => {
      const dinnerSub = {
        id: 'sub-dinner',
        status: 'EXPIRED',
        startDate: '2026-08-01',
        endDate: '2026-08-30',
        student: { id: 'stud-1', email: 'stud@test.com' },
        provider: { id: 'prov-1' },
        mealPlan: { id: 'plan-dinner', mealType: MealType.DINNER_ONLY, provider: { id: 'prov-1', recoveryPercentage: 80 } },
      };
      subRepo.findOne.mockResolvedValue(dinnerSub);

      const result = await mealRecoveryService.processSubscriptionRecovery('sub-dinner');
      expect(result.processed).toBe(false);
      expect(result.recovery).toBeNull();
      expect(recoveryRepo.save).not.toHaveBeenCalled();
    });

    it('allows meal recovery processing for FULL_DAY subscription', async () => {
      const fullDaySub = {
        id: 'sub-fullday',
        status: 'EXPIRED',
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        student: { id: 'stud-1', email: 'stud@test.com' },
        provider: { id: 'prov-1', recoveryPercentage: 80 },
        mealPlan: { id: 'plan-full', mealType: MealType.FULL_DAY, provider: { id: 'prov-1', recoveryPercentage: 80 } },
      };
      subRepo.findOne.mockResolvedValue(fullDaySub);
      recoveryRepo.findOne.mockResolvedValue(null);

      const result = await mealRecoveryService.processSubscriptionRecovery('sub-fullday');
      expect(result).toBeDefined();
      expect(result.processed).toBe(true);
      expect(recoveryRepo.save).toHaveBeenCalled();
    });
  });

  describe('4. Check-in Uniqueness and Coexistence for Multiple Subscriptions', () => {
    let mealUsageService: MealUsageService;
    let usageRepo: any;
    let auditRepo: any;
    let providerRepoForUsage: any;
    let subRepo: any;
    let userRepo: any;
    let dataSource: any;

    const mockProviderForQr = {
      id: 'prov-mess-1',
      name: 'Gourmet Mess',
      qrToken: 'pp_qr_mocktoken123456789',
    };

    const mockLunchSub = {
      id: 'sub-lunch-101',
      student: { id: 'student-A' },
      mealPlan: { id: 'plan-lunch', title: 'Lunch Plan', provider: { id: 'prov-mess-1' }, mealType: MealType.LUNCH_ONLY },
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: 'PAID',
      startDate: '2026-01-01',
      endDate: '2029-12-31',
    };

    const mockDinnerSub = {
      id: 'sub-dinner-202',
      student: { id: 'student-A' },
      mealPlan: { id: 'plan-dinner', title: 'Dinner Plan', provider: { id: 'prov-mess-1' }, mealType: MealType.DINNER_ONLY },
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: 'PAID',
      startDate: '2026-01-01',
      endDate: '2029-12-31',
    };

    const usageDb: any[] = [];

    beforeEach(async () => {
      usageDb.length = 0;

      usageRepo = {
        findOne: jest.fn(async ({ where }) => {
          return usageDb.find((u) => {
            if (where.subscriptionId && u.subscriptionId !== where.subscriptionId) return false;
            if (where.mealDate && u.mealDate !== where.mealDate) return false;
            return true;
          }) || null;
        }),
        find: jest.fn(async ({ where }) => {
          return usageDb.filter((u) => {
            if (where.mealDate && u.mealDate !== where.mealDate) return false;
            return true;
          });
        }),
        create: jest.fn((dto) => ({ id: 'usage-' + Math.random().toString(36).substring(2, 8), ...dto })),
        save: jest.fn(async (entity) => {
          usageDb.push(entity);
          return entity;
        }),
      };

      auditRepo = {
        create: jest.fn((dto) => dto),
        save: jest.fn(async (e) => e),
      };

      providerRepoForUsage = {
        findOne: jest.fn(async ({ where }) => {
          if (where.qrToken === mockProviderForQr.qrToken || where.id === mockProviderForQr.id) {
            return mockProviderForQr;
          }
          return null;
        }),
      };

      subRepo = {
        find: jest.fn(async () => [mockLunchSub, mockDinnerSub]),
      };

      userRepo = {
        findOne: jest.fn(),
      };

      dataSource = {
        transaction: jest.fn((cb) => cb({
          create: (_entity: any, dto: any) => dto,
          save: async (_entity: any, entity: any) => entity,
        })),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MealUsageService,
          { provide: getRepositoryToken(MealUsage), useValue: usageRepo },
          { provide: getRepositoryToken(MealUsageAudit), useValue: auditRepo },
          { provide: getRepositoryToken(MealProvider), useValue: providerRepoForUsage },
          { provide: getRepositoryToken(Subscription), useValue: subRepo },
          { provide: getRepositoryToken(User), useValue: userRepo },
          { provide: DataSource, useValue: dataSource },
        ],
      }).compile();

      mealUsageService = module.get<MealUsageService>(MealUsageService);
    });

    it('allows check-in for both Lunch Only and Dinner Only on the same date without collision', async () => {
      // 1. Check in for lunch subscription
      const lunchCheckIn = await mealUsageService.checkIn('student-A', 'pp_qr_mocktoken123456789', 'sub-lunch-101');
      expect(lunchCheckIn.code).toBe('CHECKED_IN');

      // 2. Check in for dinner subscription on the same day
      const dinnerCheckIn = await mealUsageService.checkIn('student-A', 'pp_qr_mocktoken123456789', 'sub-dinner-202');
      expect(dinnerCheckIn.code).toBe('CHECKED_IN');

      // Both usage records exist with different subscriptionIds on the same date
      expect(usageDb.length).toBe(2);
      expect(usageDb[0].mealDate).toEqual(usageDb[1].mealDate);
      expect(usageDb[0].subscriptionId).not.toEqual(usageDb[1].subscriptionId);
    });

    it('rejects double check-in on the SAME subscription on the same day', async () => {
      const firstCheckIn = await mealUsageService.checkIn('student-A', 'pp_qr_mocktoken123456789', 'sub-lunch-101');
      expect(firstCheckIn.code).toBe('CHECKED_IN');

      const secondCheckIn = await mealUsageService.checkIn('student-A', 'pp_qr_mocktoken123456789', 'sub-lunch-101');
      expect(secondCheckIn.code).toBe('ALREADY_CHECKED_IN');
    });
  });
});
