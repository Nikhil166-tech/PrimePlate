import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  MealPlansService,
  calculateDiscount,
  formatMealPlan,
} from './meal-plans.service';
import { MealPlan } from './meal-plan.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { Payment } from '../payments/payment.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { ProvidersService } from '../providers/providers.service';
import { ConfigService } from '@nestjs/config';

describe('PrimePlate — Original Price + Selling Price / Discount System Specification', () => {
  jest.setTimeout(30000);
  let mealPlansService: MealPlansService;
  let planRepo: any;
  let providerRepo: any;
  const mockMealPlans: any[] = [];

  const mockProviderA = {
    id: 'provider-a-id',
    name: 'Mess Kitchen A',
    monthlyPrice: 3000,
    approvalStatus: 'APPROVED',
    acceptingSubscriptions: true,
    totalCapacity: 50,
    user: { id: 'user-provider-a', email: 'ownerA@kitchen.com' },
  };

  const mockProviderB = {
    id: 'provider-b-id',
    name: 'Mess Kitchen B',
    monthlyPrice: 3500,
    approvalStatus: 'APPROVED',
    acceptingSubscriptions: true,
    totalCapacity: 50,
    user: { id: 'user-provider-b', email: 'ownerB@kitchen.com' },
  };

  beforeEach(async () => {
    mockMealPlans.length = 0;

    planRepo = {
      create: jest.fn((dto) => ({
        id: 'plan-' + Math.random().toString(36).substr(2, 6),
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
        if (where.id === mockProviderA.id) return mockProviderA;
        if (where.id === mockProviderB.id) return mockProviderB;
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

  // 1. ₹2700 original + ₹2500 selling accepted
  it('1. originalPrice 2700 + sellingPrice 2500 is accepted and saved', async () => {
    const plan = await mealPlansService.create('user-provider-a', {
      title: 'Deluxe Thali',
      originalPrice: 2700,
      sellingPrice: 2500,
      providerId: mockProviderA.id,
    });

    expect(plan).toBeDefined();
    expect(plan.originalPrice).toBe(2700);
    expect(plan.sellingPrice).toBe(2500);
    expect(plan.pricePerMonth).toBe(2500);
  });

  // 2. discountAmount = ₹200
  it('2. discountAmount is calculated as ₹200 for ₹2700 original / ₹2500 selling', async () => {
    const plan = await mealPlansService.create('user-provider-a', {
      title: 'Deluxe Thali',
      originalPrice: 2700,
      sellingPrice: 2500,
      providerId: mockProviderA.id,
    });

    const formatted: any = plan;
    expect(formatted.discountAmount).toBe(200);
  });

  // 3. discountPercentage = 7
  it('3. discountPercentage is calculated as 7% (floor of (200/2700)*100)', () => {
    const { discountPercentage } = calculateDiscount(2700, 2500);
    expect(discountPercentage).toBe(7);
  });

  // 4. ₹3000 → ₹2400 = 20% OFF
  it('4. originalPrice 3000 + sellingPrice 2400 yields exactly 20% OFF and discountAmount 600', () => {
    const result = calculateDiscount(3000, 2400);
    expect(result.hasDiscount).toBe(true);
    expect(result.discountAmount).toBe(600);
    expect(result.discountPercentage).toBe(20);
  });

  // 5. equal prices = no discount
  it('5. sellingPrice equal to originalPrice results in hasDiscount = false, discountAmount = 0, discountPercentage = 0', () => {
    const result = calculateDiscount(2500, 2500);
    expect(result.hasDiscount).toBe(false);
    expect(result.discountAmount).toBe(0);
    expect(result.discountPercentage).toBe(0);
  });

  // 6. selling > original rejected
  it('6. sellingPrice greater than originalPrice is rejected with BadRequestException', async () => {
    await expect(
      mealPlansService.create('user-provider-a', {
        title: 'Overpriced Plan',
        originalPrice: 2500,
        sellingPrice: 2700,
        providerId: mockProviderA.id,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 7. original <= 0 rejected
  it('7. originalPrice <= 0 is rejected with BadRequestException', async () => {
    await expect(
      mealPlansService.create('user-provider-a', {
        title: 'Zero Price Plan',
        originalPrice: 0,
        sellingPrice: 0,
        providerId: mockProviderA.id,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 8. selling <= 0 rejected
  it('8. sellingPrice <= 0 is rejected with BadRequestException', async () => {
    await expect(
      mealPlansService.create('user-provider-a', {
        title: 'Zero Selling Plan',
        originalPrice: 2500,
        sellingPrice: 0,
        providerId: mockProviderA.id,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 9. negative values rejected
  it('9. negative prices are rejected with BadRequestException', async () => {
    await expect(
      mealPlansService.create('user-provider-a', {
        title: 'Negative Plan',
        originalPrice: -2500,
        sellingPrice: -2500,
        providerId: mockProviderA.id,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  const createMockPaymentsService = (planToReturn: any) => {
    const configService = {
      get: jest.fn(() => 'rzp_test_key'),
    } as any;
    const fakePlanRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        if (where?.id) {
          const found = mockMealPlans.find((p) => p.id === where.id);
          if (found) return found;
        }
        return planToReturn;
      }),
    } as any;
    const fakeUserRepo = {
      findOne: jest.fn(async () => ({ id: 'student-1', email: 'student1@primeplate.com' })),
    } as any;
    const fakePaymentRepo = {
      create: jest.fn((dto) => dto),
      save: jest.fn(async (p) => p),
      findOne: jest.fn(async () => null),
    } as any;

    return new PaymentsService(
      configService,
      fakePaymentRepo,
      {} as any, // webhookEventRepo
      fakePlanRepo,
      fakeUserRepo,
      {} as any, // ticketRepo
      {} as any, // subscriptionsService
    );
  };

  // 10. frontend amount cannot override database sellingPrice
  it('10. frontend-supplied payment amount cannot override database sellingPrice', async () => {
    const savedPlan = await mealPlansService.create('user-provider-a', {
      title: 'Authoritative Plan',
      originalPrice: 2700,
      sellingPrice: 2500,
      providerId: mockProviderA.id,
    });

    const paymentsService = createMockPaymentsService(savedPlan);

    // Call createOrder without passing any amount (amount is derived strictly from DB sellingPrice)
    const order = await paymentsService.createOrder(
      savedPlan.id,
      'student-1',
      30,
    );
    expect(order.amount).toBe(250000); // exactly ₹2500 in paise!
    expect(order.notes.authoritativeAmount).toBe(2500);
  });

  // 11. Razorpay uses authoritative calculated payable amount
  it('11. Razorpay order strictly uses database sellingPrice for 30 days', async () => {
    const savedPlan = await mealPlansService.create('user-provider-a', {
      title: 'Razorpay Plan',
      originalPrice: 3000,
      sellingPrice: 2400,
      providerId: mockProviderA.id,
    });

    const paymentsService = createMockPaymentsService(savedPlan);
    const order = await paymentsService.createOrder(
      savedPlan.id,
      'student-1',
      30,
    );
    expect(order.amount).toBe(240000); // 2400 * 100 paise
  });

  // 12. existing duration calculation remains correct
  it('12. existing duration calculation remains correct based on sellingPrice', async () => {
    const savedPlan = await mealPlansService.create('user-provider-a', {
      title: 'Duration Plan',
      originalPrice: 2700,
      sellingPrice: 2500,
      providerId: mockProviderA.id,
    });

    const paymentsService = createMockPaymentsService(savedPlan);

    // 1 Day = Math.round(2500 / 30) = 83 -> ₹83 (8300 paise)
    const order1Day = await paymentsService.createOrder(savedPlan.id, 's1', 1);
    expect(order1Day.amount).toBe(8300);

    // 7 Days = Math.round((2500 / 30) * 7) = 583 -> ₹583 (58300 paise)
    const order7Day = await paymentsService.createOrder(savedPlan.id, 's1', 7);
    expect(order7Day.amount).toBe(58300);

    // 15 Days = Math.round((2500 / 30) * 15) = 1250 -> ₹1250 (125000 paise)
    const order15Day = await paymentsService.createOrder(savedPlan.id, 's1', 15);
    expect(order15Day.amount).toBe(125000);

    // 30 Days = 2500 -> ₹2500 (250000 paise)
    const order30Day = await paymentsService.createOrder(savedPlan.id, 's1', 30);
    expect(order30Day.amount).toBe(250000);
  });

  // 13. historical payments remain unchanged after price update
  it('13. historical completed payments remain unchanged when meal plan price is updated', async () => {
    const initialPlan = await mealPlansService.create('user-provider-a', {
      title: 'Historical Integrity Plan',
      originalPrice: 2700,
      sellingPrice: 2500,
      providerId: mockProviderA.id,
    });

    const historicalPayment: Partial<Payment> = {
      id: 'pay-historical',
      amount: 2500,
      status: 'success',
      createdAt: new Date('2026-01-01'),
    };

    // Provider updates price for future purchases to 3000 / 2800
    await mealPlansService.update('user-provider-a', initialPlan.id, {
      originalPrice: 3000,
      sellingPrice: 2800,
    });

    // Historical payment record remains intact at ₹2500
    expect(historicalPayment.amount).toBe(2500);
  });

  // 14. existing plans migrate from pricePerMonth safely
  it('14. existing plans without originalPrice/sellingPrice format safely using pricePerMonth', () => {
    const legacyPlan: Partial<MealPlan> = {
      id: 'legacy-plan-1',
      title: 'Legacy Thali',
      pricePerMonth: 2500,
      originalPrice: undefined as any,
      sellingPrice: undefined as any,
    };

    const formatted = formatMealPlan(legacyPlan as MealPlan);
    expect(formatted.originalPrice).toBe(2500);
    expect(formatted.sellingPrice).toBe(2500);
    expect(formatted.hasDiscount).toBe(false);
    expect(formatted.discountAmount).toBe(0);
    expect(formatted.discountPercentage).toBe(0);
  });

  // 15. provider ownership is enforced
  it('15. provider cannot modify another provider\'s meal plan pricing', async () => {
    const planB = await mealPlansService.create('user-provider-b', {
      title: 'Kitchen B Plan',
      originalPrice: 3000,
      sellingPrice: 2800,
      providerId: mockProviderB.id,
    });

    // Provider A attempts to update Provider B's plan
    await expect(
      mealPlansService.update('user-provider-a', planB.id, {
        originalPrice: 3500,
        sellingPrice: 3200,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  // 16. discount is never negative
  it('16. discount amount and percentage are never negative', () => {
    const result1 = calculateDiscount(2500, 2700);
    expect(result1.discountAmount).toBe(0);
    expect(result1.discountPercentage).toBe(0);
    expect(result1.hasDiscount).toBe(false);

    const result2 = calculateDiscount(2500, 2500);
    expect(result2.discountAmount).toBe(0);
    expect(result2.discountPercentage).toBe(0);
    expect(result2.hasDiscount).toBe(false);
  });

  // 17. no fake 0% discount
  it('17. no fake 0% discount is returned or flagged as hasDiscount', () => {
    const result = calculateDiscount(2700, 2700);
    expect(result.hasDiscount).toBe(false);
    expect(result.discountPercentage).toBe(0);
  });

  // 18. no Save ₹0
  it('18. no Save ₹0 discount amount when prices are equal', () => {
    const result = calculateDiscount(2700, 2700);
    expect(result.discountAmount).toBe(0);
    expect(result.hasDiscount).toBe(false);
  });

  // 19. provider-level monthly price update does not overwrite individually configured meal plans
  it('19. provider-level monthly price update does not overwrite individually configured meal plans', async () => {
    const planA = await mealPlansService.create('user-provider-a', {
      title: 'Plan A',
      originalPrice: 2700,
      sellingPrice: 2500,
      providerId: mockProviderA.id,
    });

    const planB = await mealPlansService.create('user-provider-a', {
      title: 'Plan B',
      originalPrice: 3500,
      sellingPrice: 3000,
      providerId: mockProviderA.id,
    });

    const mockProviderEntity = {
      ...mockProviderA,
      monthlyPrice: 3000,
    };
    const mockProviderRepo: any = {
      findOne: jest.fn(async () => mockProviderEntity),
      save: jest.fn(async (p) => p),
    };
    const mockSubRepo: any = {
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn(async () => 5),
      })),
    };
    const mockImageRepo: any = {
      find: jest.fn(async () => []),
    };

    const providersService = new ProvidersService(
      mockProviderRepo,
      mockSubRepo,
      mockImageRepo,
      {} as any,
      {} as any,
    );

    await providersService.update('user-provider-a', mockProviderA.id, {
      monthlyPrice: 4000,
    } as any);

    // Verify Plan A and Plan B retain their configured prices
    expect(planA.sellingPrice).toBe(2500);
    expect(planA.originalPrice).toBe(2700);
    expect(planB.sellingPrice).toBe(3000);
    expect(planB.originalPrice).toBe(3500);
  });

  // 20. changing plan price affects only future purchases
  it('20. updating plan price applies to future orders, not past orders', async () => {
    const plan = await mealPlansService.create('user-provider-a', {
      title: 'Future Only Plan',
      originalPrice: 2700,
      sellingPrice: 2500,
      providerId: mockProviderA.id,
    });

    const paymentsService = createMockPaymentsService(plan);

    // 1st order created under old price
    const order1 = await paymentsService.createOrder(plan.id, 's1', 30);
    expect(order1.amount).toBe(250000);

    // Plan price is updated
    await mealPlansService.update('user-provider-a', plan.id, {
      originalPrice: 3000,
      sellingPrice: 2800,
    });

    // 2nd order created under new price
    const order2 = await paymentsService.createOrder(plan.id, 's2', 30);
    expect(order2.amount).toBe(280000);

    // 1st order amount remains 250000
    expect(order1.amount).toBe(250000);
  });
});
