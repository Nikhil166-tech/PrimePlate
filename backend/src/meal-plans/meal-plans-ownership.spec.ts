import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MealPlansService } from './meal-plans.service';
import { MealPlan } from './meal-plan.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('MealPlansService Fail-Closed Provider Ownership Validation', () => {
  let service: MealPlansService;
  let planRepo: any;
  let providerRepo: any;

  const validOwnerId = 'owner-uuid-123';
  const wrongOwnerId = 'wrong-owner-uuid-999';
  const providerId = 'provider-uuid-abc';
  const planId = 'plan-uuid-xyz';

  beforeEach(async () => {
    planRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ id: planId, ...data })),
      save: jest.fn(async (data) => ({ id: planId, ...data })),
      find: jest.fn(),
    };

    providerRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealPlansService,
        { provide: getRepositoryToken(MealPlan), useValue: planRepo },
        { provide: getRepositoryToken(MealProvider), useValue: providerRepo },
      ],
    }).compile();

    service = module.get<MealPlansService>(MealPlansService);
  });

  describe('create meal plan ownership check', () => {
    const createDto = {
      providerId,
      title: 'Healthy Mess Lunch',
      originalPrice: 3000,
      sellingPrice: 2700,
    };

    it('1. missing owner relation (userId & user are null/undefined) → REJECTED (fail-closed)', async () => {
      // Provider exists but has no owner information loaded / corrupted
      providerRepo.findOne.mockResolvedValue({
        id: providerId,
        name: 'Orphan Kitchen',
        userId: null,
        user: null,
      });

      await expect(service.create(validOwnerId, createDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('2. wrong owner ID → REJECTED with ForbiddenException', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: providerId,
        name: 'Another Kitchen',
        userId: wrongOwnerId,
        user: { id: wrongOwnerId },
      });

      await expect(service.create(validOwnerId, createDto)).rejects.toThrow(
        'Cannot create meal plans for another provider',
      );
    });

    it('3. correct owner ID → ALLOWED', async () => {
      providerRepo.findOne.mockResolvedValue({
        id: providerId,
        name: 'Valid Kitchen',
        userId: validOwnerId,
        user: { id: validOwnerId },
      });

      const result = await service.create(validOwnerId, createDto);
      expect(result).toBeDefined();
      expect(result.title).toBe('Healthy Mess Lunch');
      expect(planRepo.save).toHaveBeenCalled();
    });
  });

  describe('update meal plan ownership check', () => {
    const updateDto = {
      sellingPrice: 2500,
    };

    it('4. missing owner on meal plan provider → REJECTED (fail-closed)', async () => {
      planRepo.findOne.mockResolvedValue({
        id: planId,
        originalPrice: 3000,
        sellingPrice: 2700,
        provider: {
          id: providerId,
          userId: null,
          user: null,
        },
      });

      await expect(service.update(validOwnerId, planId, updateDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('5. wrong owner updating meal plan → REJECTED with ForbiddenException', async () => {
      planRepo.findOne.mockResolvedValue({
        id: planId,
        originalPrice: 3000,
        sellingPrice: 2700,
        provider: {
          id: providerId,
          userId: wrongOwnerId,
          user: { id: wrongOwnerId },
        },
      });

      await expect(service.update(validOwnerId, planId, updateDto)).rejects.toThrow(
        "Cannot modify another provider's meal plan pricing",
      );
    });

    it('6. correct owner updating meal plan → ALLOWED', async () => {
      planRepo.findOne.mockResolvedValue({
        id: planId,
        originalPrice: 3000,
        sellingPrice: 2700,
        provider: {
          id: providerId,
          userId: validOwnerId,
          user: { id: validOwnerId },
        },
      });

      const result = await service.update(validOwnerId, planId, updateDto);
      expect(result.sellingPrice).toBe(2500);
      expect(planRepo.save).toHaveBeenCalled();
    });
  });
});
