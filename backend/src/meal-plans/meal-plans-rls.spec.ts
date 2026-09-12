import { EnableRlsOnMealPlans1786450000000 } from '../migrations/1786450000000-EnableRlsOnMealPlans';
import { MealPlansService } from './meal-plans.service';
import { MealPlan } from './meal-plan.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('PrimePlate — meal_plans Row Level Security (RLS) & Migration Verification', () => {
  describe('Migration: EnableRlsOnMealPlans1786450000000', () => {
    let migration: EnableRlsOnMealPlans1786450000000;

    beforeEach(() => {
      migration = new EnableRlsOnMealPlans1786450000000();
    });

    it('should have correct migration name and interface contract', () => {
      expect(migration.name).toBe('EnableRlsOnMealPlans1786450000000');
      expect(typeof migration.up).toBe('function');
      expect(typeof migration.down).toBe('function');
    });

    it('should execute PostgreSQL RLS enable and revoke SQL when connection is postgres', async () => {
      const executedQueries: string[] = [];
      const mockQueryRunner: any = {
        connection: {
          options: {
            type: 'postgres',
          },
        },
        query: jest.fn(async (sql: string) => {
          executedQueries.push(sql);
        }),
      };

      await migration.up(mockQueryRunner);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(2);

      // 1. Must enable Row Level Security on meal_plans
      expect(executedQueries[0]).toContain(
        'ALTER TABLE "meal_plans" ENABLE ROW LEVEL SECURITY;',
      );

      // 2. Must revoke privileges from anon and authenticated PostgREST roles safely
      expect(executedQueries[1]).toContain(
        'REVOKE ALL ON TABLE "meal_plans" FROM "anon";',
      );
      expect(executedQueries[1]).toContain(
        'REVOKE ALL ON TABLE "meal_plans" FROM "authenticated";',
      );
      expect(executedQueries[1]).toContain("WHERE rolname = 'anon'");
      expect(executedQueries[1]).toContain("WHERE rolname = 'authenticated'");

      // Verify no generic/broken policies are created in the migration
      expect(executedQueries.some((q) => q.includes('auth.uid()'))).toBe(false);
      expect(executedQueries.some((q) => q.includes('USING (true)'))).toBe(
        false,
      );
    });

    it('should execute PostgreSQL RLS disable and restore grants in down() migration', async () => {
      const executedQueries: string[] = [];
      const mockQueryRunner: any = {
        connection: {
          options: {
            type: 'postgres',
          },
        },
        query: jest.fn(async (sql: string) => {
          executedQueries.push(sql);
        }),
      };

      await migration.down(mockQueryRunner);

      expect(mockQueryRunner.query).toHaveBeenCalledTimes(2);

      // 1. Must restore table grants conditionally
      expect(executedQueries[0]).toContain(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "meal_plans" TO "anon";',
      );
      expect(executedQueries[0]).toContain(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "meal_plans" TO "authenticated";',
      );

      // 2. Must disable Row Level Security
      expect(executedQueries[1]).toContain(
        'ALTER TABLE "meal_plans" DISABLE ROW LEVEL SECURITY;',
      );
    });

    it('should safely no-op for non-postgres connection types (e.g. SQLite test environments)', async () => {
      const mockQueryRunner: any = {
        connection: {
          options: {
            type: 'better-sqlite3',
          },
        },
        query: jest.fn(),
      };

      await migration.up(mockQueryRunner);
      expect(mockQueryRunner.query).not.toHaveBeenCalled();

      await migration.down(mockQueryRunner);
      expect(mockQueryRunner.query).not.toHaveBeenCalled();
    });
  });

  describe('NestJS Service Layer: Application Authorization & IDOR Protection Integrity', () => {
    let mealPlansService: MealPlansService;
    let mockPlanRepo: any;
    let mockProviderRepo: any;

    const mockProviderA: Partial<MealProvider> = {
      id: 'provider-kitchen-1',
      name: 'North Indian Mess Kitchen',
      user: { id: 'owner-user-1', email: 'owner1@test.com' } as any,
    };

    const mockProviderB: Partial<MealProvider> = {
      id: 'provider-kitchen-2',
      name: 'South Indian Mess Kitchen',
      user: { id: 'owner-user-2', email: 'owner2@test.com' } as any,
    };

    const mockPlan1: Partial<MealPlan> = {
      id: 'plan-uuid-1',
      title: 'Standard Monthly Thali',
      pricePerMonth: 2500,
      originalPrice: 3000,
      sellingPrice: 2500,
      isActive: true,
      provider: mockProviderA as MealProvider,
    };

    beforeEach(() => {
      mockPlanRepo = {
        findOne: jest.fn(),
        find: jest.fn(),
        create: jest.fn((data) => ({ id: 'new-plan-id', ...data })),
        save: jest.fn(async (entity) => entity),
      };

      mockProviderRepo = {
        findOne: jest.fn(),
      };

      mealPlansService = new MealPlansService(mockPlanRepo, mockProviderRepo);
    });

    it('allows a provider to create a meal plan for their own kitchen', async () => {
      mockProviderRepo.findOne.mockResolvedValue(mockProviderA);

      const result = await mealPlansService.create('owner-user-1', {
        title: 'Deluxe Veg Plan',
        providerId: 'provider-kitchen-1',
        originalPrice: 3500,
        sellingPrice: 2999,
      });

      expect(result).toBeDefined();
      expect(result.title).toBe('Deluxe Veg Plan');
      expect(result.sellingPrice).toBe(2999);
      expect(result.originalPrice).toBe(3500);
      expect(mockPlanRepo.save).toHaveBeenCalled();
    });

    it('strictly forbids a provider from creating a meal plan for another provider (IDOR prevention)', async () => {
      mockProviderRepo.findOne.mockResolvedValue(mockProviderA);

      await expect(
        mealPlansService.create('attacker-user-id', {
          title: 'Hacked Meal Plan',
          providerId: 'provider-kitchen-1',
          originalPrice: 1000,
          sellingPrice: 500,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });

    it('allows a provider to update their own meal plan', async () => {
      mockPlanRepo.findOne.mockResolvedValue({
        ...mockPlan1,
        provider: { ...mockProviderA, user: { id: 'owner-user-1' } },
      });

      const updated = await mealPlansService.update(
        'owner-user-1',
        'plan-uuid-1',
        {
          title: 'Updated Thali Plan',
          originalPrice: 3200,
          sellingPrice: 2600,
        },
      );

      expect(updated.title).toBe('Updated Thali Plan');
      expect(updated.sellingPrice).toBe(2600);
      expect(mockPlanRepo.save).toHaveBeenCalled();
    });

    it('strictly forbids a provider from updating another provider plan (IDOR prevention)', async () => {
      mockPlanRepo.findOne.mockResolvedValue({
        ...mockPlan1,
        provider: { ...mockProviderA, user: { id: 'owner-user-1' } },
      });

      await expect(
        mealPlansService.update('attacker-user-id', 'plan-uuid-1', {
          sellingPrice: 100,
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPlanRepo.save).not.toHaveBeenCalled();
    });

    it('allows students/public discovery via findByProvider and findById', async () => {
      mockPlanRepo.find.mockResolvedValue([mockPlan1]);
      mockPlanRepo.findOne.mockResolvedValue(mockPlan1);

      const plans = await mealPlansService.findByProvider('provider-kitchen-1');
      expect(plans).toHaveLength(1);
      expect(plans[0].title).toBe('Standard Monthly Thali');

      const plan = await mealPlansService.findById('plan-uuid-1');
      expect(plan.id).toBe('plan-uuid-1');
    });
  });
});
