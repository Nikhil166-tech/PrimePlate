import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { Subscription, SubscriptionStatus } from './subscription.entity';
import { User } from '../users/user.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { Role } from '../common/roles.enum';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('Admin Subscription Provisioning Bug Fix (Target Student Assignment)', () => {
  let controller: SubscriptionsController;
  let service: SubscriptionsService;
  let mockManager: any;
  let subRepo: any;

  const adminUserId = 'admin-uuid-000';
  const targetStudentId = 'student-uuid-aaa';
  const nonStudentId = 'provider-user-uuid-bbb';
  const mealPlanId = 'plan-uuid-111';
  const providerId = 'provider-uuid-222';

  beforeEach(async () => {
    mockManager = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((entity, data) => data),
      count: jest.fn(),
      connection: { options: { type: 'better-sqlite3' } },
    };

    subRepo = {
      manager: {
        transaction: jest.fn((cb) => cb(mockManager)),
      },
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [
        SubscriptionsService,
        { provide: getRepositoryToken(Subscription), useValue: subRepo },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        {
          provide: getRepositoryToken(MealPlan),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  it('1. Controller should extract target studentId from body and NOT use req.user.userId (admin ID)', async () => {
    const createSpy = jest.spyOn(service, 'create').mockResolvedValue({
      id: 'sub-new',
      student: { id: targetStudentId } as any,
    } as any);

    const mockAdminReq: any = {
      user: { userId: adminUserId, role: Role.ADMIN },
    };

    const result = await controller.create(mockAdminReq, {
      studentId: targetStudentId,
      mealPlanId,
      startDate: '2026-09-15',
      endDate: '2026-10-14',
    });

    expect(createSpy).toHaveBeenCalledWith(
      targetStudentId,
      mealPlanId,
      '2026-09-15',
      '2026-10-14',
    );
    expect(createSpy).not.toHaveBeenCalledWith(
      adminUserId,
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(result.student.id).toBe(targetStudentId);
  });

  it('2. Controller should throw BadRequestException if studentId is missing in admin body', async () => {
    const mockAdminReq: any = {
      user: { userId: adminUserId, role: Role.ADMIN },
    };

    await expect(
      controller.create(mockAdminReq, {
        studentId: '',
        mealPlanId,
      } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. Service should create subscription assigned to target Student A and NOT Admin', async () => {
    const mockStudent = {
      id: targetStudentId,
      role: Role.STUDENT,
      name: 'Alice Student',
    };
    const mockProvider = {
      id: providerId,
      approvalStatus: 'APPROVED',
      acceptingSubscriptions: true,
      totalCapacity: 50,
    };
    const mockMealPlan = {
      id: mealPlanId,
      provider: mockProvider,
    };

    mockManager.findOne.mockImplementation((entity: any, opts: any) => {
      if (entity === User && opts?.where?.id === targetStudentId) {
        return Promise.resolve(mockStudent);
      }
      if (entity === MealPlan && opts?.where?.id === mealPlanId) {
        return Promise.resolve(mockMealPlan);
      }
      if (entity === MealProvider && opts?.where?.id === providerId) {
        return Promise.resolve(mockProvider);
      }
      return Promise.resolve(null);
    });

    mockManager.count.mockResolvedValue(10); // current active count < 50
    mockManager.save.mockImplementation((entity: any, data: any) =>
      Promise.resolve({ id: 'sub-created-1', ...data }),
    );

    const sub = await service.create(targetStudentId, mealPlanId);

    expect(sub.student).toEqual(mockStudent);
    expect(sub.student.id).toBe(targetStudentId);
    expect(sub.student.id).not.toBe(adminUserId);
    expect(sub.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('4. Service should reject if target user does not have STUDENT role', async () => {
    const mockNonStudent = {
      id: nonStudentId,
      role: Role.PROVIDER,
      name: 'Provider User',
    };

    mockManager.findOne.mockImplementation((entity: any, opts: any) => {
      if (entity === User && opts?.where?.id === nonStudentId) {
        return Promise.resolve(mockNonStudent);
      }
      return Promise.resolve(null);
    });

    await expect(service.create(nonStudentId, mealPlanId)).rejects.toThrow(
      'Target user must have the STUDENT role to receive a subscription',
    );
  });

  it('5. Service should reject if target student does not exist', async () => {
    mockManager.findOne.mockResolvedValue(null);

    await expect(
      service.create('non-existent-student', mealPlanId),
    ).rejects.toThrow(NotFoundException);
  });
});
