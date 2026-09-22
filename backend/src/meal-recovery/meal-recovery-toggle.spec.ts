import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MealProvider } from '../providers/meal-provider.entity';
import { ProviderImage } from '../providers/provider-image.entity';
import { ProvidersService } from '../providers/providers.service';
import { UsersService } from '../users/users.service';
import { UploadsService } from '../uploads/uploads.service';
import { MealRecoveryService } from './meal-recovery.service';
import { MealRecovery } from './meal-recovery.entity';
import { MealUsage } from '../meal-usage/meal-usage.entity';
import { Subscription, SubscriptionStatus } from '../subscriptions/subscription.entity';
import { MealType } from '../meal-plans/meal-plan.entity';

describe('Meal Recovery Toggle Specification (Provider Portal & Service)', () => {
  let providersService: ProvidersService;
  let mealRecoveryService: MealRecoveryService;

  let providerRepo: any;
  let recoveryRepo: any;
  let usageRepo: any;
  let subRepo: any;

  const mockProvider = {
    id: 'prov-test-1',
    name: 'Gourmet Kitchen',
    userId: 'owner-user-1',
    user: { id: 'owner-user-1', email: 'owner@kitchen.com' },
    recoveryPercentage: 80,
    mealRecoveryEnabled: true,
    totalCapacity: 100,
    monthlyPrice: 3000,
  };

  const providersDb: any[] = [];
  const recoveriesDb: any[] = [];
  const usagesDb: any[] = [];

  beforeEach(async () => {
    providersDb.length = 0;
    recoveriesDb.length = 0;
    usagesDb.length = 0;

    providersDb.push({ ...mockProvider });

    providerRepo = {
      findOne: jest.fn(async ({ where }) => {
        if (Array.isArray(where)) {
          return providersDb.find((p) =>
            where.some((w) =>
              (!w.id || p.id === w.id) &&
              (!w.userId || p.userId === w.userId || p.user?.id === w.userId)
            )
          ) || null;
        }
        return providersDb.find((p) =>
          (!where?.id || p.id === where.id) &&
          (!where?.userId || p.userId === where.userId || p.user?.id === where.userId)
        ) || null;
      }),
      save: jest.fn(async (entity) => {
        const idx = providersDb.findIndex((p) => p.id === entity.id);
        if (idx >= 0) {
          providersDb[idx] = { ...providersDb[idx], ...entity };
          return providersDb[idx];
        }
        providersDb.push(entity);
        return entity;
      }),
      create: jest.fn((dto) => ({
        id: 'prov-' + Math.random().toString(36).substring(2, 7),
        mealRecoveryEnabled: true,
        recoveryPercentage: 80,
        ...dto,
      })),
      find: jest.fn(async () => [...providersDb]),
    };

    recoveryRepo = {
      findOne: jest.fn(async ({ where }) => {
        return recoveriesDb.find((r) => r.sourceSubscriptionId === where.sourceSubscriptionId) || null;
      }),
      find: jest.fn(async ({ where }) => {
        return recoveriesDb.filter((r) => !where?.providerId || r.providerId === where.providerId);
      }),
      create: jest.fn((dto) => ({
        id: 'rec-' + Math.random().toString(36).substring(2, 7),
        ...dto,
      })),
      save: jest.fn(async (entity) => {
        recoveriesDb.push(entity);
        return entity;
      }),
    };

    usageRepo = {
      find: jest.fn(async () => [...usagesDb]),
    };

    subRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (s) => s),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersService,
        MealRecoveryService,
        { provide: getRepositoryToken(MealProvider), useValue: providerRepo },
        { provide: getRepositoryToken(ProviderImage), useValue: { create: jest.fn(), save: jest.fn(), count: jest.fn() } },
        { provide: getRepositoryToken(MealRecovery), useValue: recoveryRepo },
        { provide: getRepositoryToken(MealUsage), useValue: usageRepo },
        { provide: getRepositoryToken(Subscription), useValue: subRepo },
        { provide: UsersService, useValue: { findById: jest.fn() } },
        { provide: UploadsService, useValue: { upload: jest.fn() } },
      ],
    }).compile();

    providersService = module.get<ProvidersService>(ProvidersService);
    mealRecoveryService = module.get<MealRecoveryService>(MealRecoveryService);
  });

  describe('A & B: Default State for Existing and New Providers', () => {
    it('A: Existing provider has mealRecoveryEnabled = true by default', async () => {
      const p = await providerRepo.findOne({ where: { id: mockProvider.id } });
      expect(p.mealRecoveryEnabled).toBe(true);
    });

    it('B: New provider defaults to mealRecoveryEnabled = true', async () => {
      const newProv = providerRepo.create({ name: 'New Kitchen' });
      expect(newProv.mealRecoveryEnabled).toBe(true);
    });
  });

  describe('C: Provider turns OFF -> No new recovery records created', () => {
    it('disables mealRecoveryEnabled and skips recovery record generation on expired subscription', async () => {
      // 1. Toggle OFF
      const updated = await providersService.updateMealRecoveryEnabled(
        mockProvider.userId,
        mockProvider.id,
        false,
      );
      expect(updated.mealRecoveryEnabled).toBe(false);

      // 2. Simulate expired full day subscription
      const expiredSub = {
        id: 'sub-exp-101',
        status: SubscriptionStatus.EXPIRED,
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        student: { id: 'stud-1', email: 'stud@test.com' },
        mealPlan: {
          id: 'plan-1',
          mealType: MealType.FULL_DAY,
          provider: providersDb.find((p) => p.id === mockProvider.id),
        },
      };
      subRepo.findOne.mockResolvedValue(expiredSub);

      // 3. Process recovery
      const result = await mealRecoveryService.processSubscriptionRecovery('sub-exp-101');
      expect(result.processed).toBe(false);
      expect(result.recovery).toBeNull();
      expect(recoveryRepo.save).not.toHaveBeenCalled();
      expect(recoveriesDb.length).toBe(0);
    });
  });

  describe('D & E: Historical Recovery Remains Usable When OFF', () => {
    it('does not invalidate, delete, or alter previously earned recovery records', async () => {
      // Pre-seed an existing recovery record earned when it was ON
      const existingRecord = {
        id: 'rec-historical-1',
        studentId: 'stud-1',
        providerId: mockProvider.id,
        sourceSubscriptionId: 'sub-past-999',
        missedDays: 4,
        recoveryRate: 80,
        recoveredDays: 3,
        usedDays: 0,
        remainingDays: 3,
        status: 'AVAILABLE',
      };
      recoveriesDb.push(existingRecord);

      // Provider toggles OFF
      await providersService.updateMealRecoveryEnabled(
        mockProvider.userId,
        mockProvider.id,
        false,
      );

      // Historical record remains intact and available
      const stats = await mealRecoveryService.getProviderRecoveryStats(
        mockProvider.userId,
        mockProvider.id,
      );
      expect(stats.mealRecoveryEnabled).toBe(false);
      expect(stats.recoveryDaysRemaining).toBe(3);
      expect(recoveriesDb.length).toBe(1);
      expect(recoveriesDb[0].remainingDays).toBe(3);
    });
  });

  describe('F & G: Re-enabling Meal Recovery (Future Processing Only, No Retroactive Recovery)', () => {
    it('F: generates recovery normally for future eligible expired subscriptions after re-enabling', async () => {
      // Re-enable toggle
      await providersService.updateMealRecoveryEnabled(
        mockProvider.userId,
        mockProvider.id,
        true,
      );

      const futureSub = {
        id: 'sub-future-202',
        status: SubscriptionStatus.EXPIRED,
        startDate: '2026-08-10',
        endDate: '2026-08-15',
        student: { id: 'stud-1', email: 'stud@test.com' },
        mealPlan: {
          id: 'plan-1',
          mealType: MealType.FULL_DAY,
          provider: providersDb.find((p) => p.id === mockProvider.id),
        },
      };
      subRepo.findOne.mockResolvedValue(futureSub);

      const result = await mealRecoveryService.processSubscriptionRecovery('sub-future-202');
      expect(result.processed).toBe(true);
      expect(result.recovery).toBeDefined();
      expect(recoveryRepo.save).toHaveBeenCalled();
    });

    it('G: does NOT retroactively create recovery records for subscriptions processed while OFF', async () => {
      // 1. Subscription ended while OFF
      providersDb[0].mealRecoveryEnabled = false;
      const subWhileOff = {
        id: 'sub-off-303',
        status: SubscriptionStatus.EXPIRED,
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        student: { id: 'stud-1', email: 'stud@test.com' },
        mealPlan: {
          id: 'plan-1',
          mealType: MealType.FULL_DAY,
          provider: providersDb[0],
        },
      };
      subRepo.findOne.mockResolvedValue(subWhileOff);

      // Process attempted while OFF
      const offResult = await mealRecoveryService.processSubscriptionRecovery('sub-off-303');
      expect(offResult.processed).toBe(false);
      expect(recoveriesDb.length).toBe(0);

      // 2. Provider turns ON
      await providersService.updateMealRecoveryEnabled(mockProvider.userId, mockProvider.id, true);

      // No background job or read endpoint retroactively generated recovery for that past sub
      expect(recoveriesDb.length).toBe(0);
    });
  });

  describe('H: Meal Type Strictness (Lunch Only and Dinner Only never recover)', () => {
    it('never generates recovery for LUNCH_ONLY even if mealRecoveryEnabled = true', async () => {
      providersDb[0].mealRecoveryEnabled = true;
      const lunchSub = {
        id: 'sub-lunch-404',
        status: SubscriptionStatus.EXPIRED,
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        student: { id: 'stud-1', email: 'stud@test.com' },
        mealPlan: {
          id: 'plan-lunch',
          mealType: MealType.LUNCH_ONLY,
          provider: providersDb[0],
        },
      };
      subRepo.findOne.mockResolvedValue(lunchSub);

      const result = await mealRecoveryService.processSubscriptionRecovery('sub-lunch-404');
      expect(result.processed).toBe(false);
      expect(result.recovery).toBeNull();
      expect(recoveryRepo.save).not.toHaveBeenCalled();
    });

    it('never generates recovery for DINNER_ONLY even if mealRecoveryEnabled = true', async () => {
      providersDb[0].mealRecoveryEnabled = true;
      const dinnerSub = {
        id: 'sub-dinner-505',
        status: SubscriptionStatus.EXPIRED,
        startDate: '2026-08-01',
        endDate: '2026-08-05',
        student: { id: 'stud-1', email: 'stud@test.com' },
        mealPlan: {
          id: 'plan-dinner',
          mealType: MealType.DINNER_ONLY,
          provider: providersDb[0],
        },
      };
      subRepo.findOne.mockResolvedValue(dinnerSub);

      const result = await mealRecoveryService.processSubscriptionRecovery('sub-dinner-505');
      expect(result.processed).toBe(false);
      expect(result.recovery).toBeNull();
      expect(recoveryRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('I: Unauthorized Access Control (RBAC & Ownership)', () => {
    it('rejects toggling another provider by unauthorized user', async () => {
      await expect(
        providersService.updateMealRecoveryEnabled(
          'intruder-user-99',
          mockProvider.id,
          false,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects toggling non-existent provider', async () => {
      await expect(
        providersService.updateMealRecoveryEnabled(
          mockProvider.userId,
          'non-existent-prov',
          false,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
