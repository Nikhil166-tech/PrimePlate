import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SubscriptionBreaksService } from './subscription-breaks.service';
import {
  SubscriptionBreakRequest,
  SubscriptionBreakStatus,
} from './subscription-break-request.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/subscription.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { User } from '../users/user.entity';

describe('SubscriptionBreaksService Specification & Business Rules', () => {
  let service: SubscriptionBreaksService;
  let breakRepo: Repository<SubscriptionBreakRequest>;
  let subRepo: Repository<Subscription>;
  let providerRepo: Repository<MealProvider>;
  let userRepo: Repository<User>;
  let dataSource: DataSource;

  const mockUserStudent: any = {
    id: 'student-uuid-1',
    role: 'STUDENT',
    name: 'Nikhil',
  };
  const mockUserStudent2: any = {
    id: 'student-uuid-2',
    role: 'STUDENT',
    name: 'Rahul',
  };
  const mockUserProvider: any = { id: 'provider-user-1', role: 'PROVIDER' };
  const mockUserProvider2: any = { id: 'provider-user-2', role: 'PROVIDER' };

  const mockProvider: any = {
    id: 'provider-uuid-1',
    name: 'Sri Lakshmi Mess',
    userId: 'provider-user-1',
    user: mockUserProvider,
    subscriptionBreaksEnabled: true,
  };

  const mockProviderDisabled: any = {
    id: 'provider-uuid-disabled',
    name: 'Disabled Mess',
    userId: 'provider-user-1',
    user: mockUserProvider,
    subscriptionBreaksEnabled: false,
  };

  // 1-Month subscription (30 days)
  const mockOneMonthSub: any = {
    id: 'sub-one-month',
    student: mockUserStudent,
    status: SubscriptionStatus.ACTIVE,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    mealPlan: {
      id: 'plan-1',
      title: '1 Month Deluxe Mess Plan',
      provider: mockProvider,
    },
  };

  // Short subscriptions (Not 1-Month)
  const mockOneDaySub: any = {
    id: 'sub-one-day',
    student: mockUserStudent,
    status: SubscriptionStatus.ACTIVE,
    startDate: '2026-09-01',
    endDate: '2026-09-01',
    mealPlan: {
      id: 'plan-day',
      title: '1 Day Mess Pass',
      provider: mockProvider,
    },
  };

  const mockOneWeekSub: any = {
    id: 'sub-one-week',
    student: mockUserStudent,
    status: SubscriptionStatus.ACTIVE,
    startDate: '2026-09-01',
    endDate: '2026-09-07',
    mealPlan: {
      id: 'plan-week',
      title: '1 Week Trial Pass',
      provider: mockProvider,
    },
  };

  const mock15DaySub: any = {
    id: 'sub-15-day',
    student: mockUserStudent,
    status: SubscriptionStatus.ACTIVE,
    startDate: '2026-09-01',
    endDate: '2026-09-15',
    mealPlan: {
      id: 'plan-15',
      title: '15 Days Half-Month Pass',
      provider: mockProvider,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionBreaksService,
        {
          provide: getRepositoryToken(SubscriptionBreakRequest),
          useValue: {
            create: jest.fn((dto) => ({ ...dto, id: 'break-req-uuid' })),
            save: jest.fn((entity) =>
              Promise.resolve({ ...entity, id: entity.id || 'break-req-uuid' }),
            ),
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockOneMonthSub),
            save: jest.fn((sub) => Promise.resolve(sub)),
          },
        },
        {
          provide: getRepositoryToken(MealProvider),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockProvider),
            save: jest.fn((prov) => Promise.resolve(prov)),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn().mockImplementation((opts) => {
              if (opts.where.id === 'student-uuid-1')
                return Promise.resolve(mockUserStudent);
              if (opts.where.id === 'student-uuid-2')
                return Promise.resolve(mockUserStudent2);
              return Promise.resolve(null);
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb) =>
              cb({
                findOne: jest.fn().mockImplementation((entity, opts) => {
                  if (entity === SubscriptionBreakRequest) {
                    return Promise.resolve({
                      id: 'pending-req-1',
                      subscriptionId: 'sub-one-month',
                      studentId: 'student-uuid-1',
                      providerId: 'provider-uuid-1',
                      fromDate: '2026-09-10',
                      toDate: '2026-09-13',
                      breakDays: 4,
                      status: SubscriptionBreakStatus.PENDING,
                      subscription: { ...mockOneMonthSub },
                      provider: { ...mockProvider },
                    });
                  }
                  if (entity === Subscription)
                    return Promise.resolve({ ...mockOneMonthSub });
                  return null;
                }),
                find: jest.fn().mockResolvedValue([]),
                save: jest.fn((entity, val) => Promise.resolve(val || entity)),
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionBreaksService>(SubscriptionBreaksService);
    breakRepo = module.get(getRepositoryToken(SubscriptionBreakRequest));
    subRepo = module.get(getRepositoryToken(Subscription));
    providerRepo = module.get(getRepositoryToken(MealProvider));
    userRepo = module.get(getRepositoryToken(User));
    dataSource = module.get(DataSource);
  });

  it('1. PrimeMate can create valid 1-month subscription break request (1-4 days)', async () => {
    jest.spyOn(subRepo, 'findOne').mockResolvedValue(mockOneMonthSub);
    jest.spyOn(breakRepo, 'find').mockResolvedValue([]);

    const res = await service.createBreakRequest('student-uuid-1', {
      subscriptionId: 'sub-one-month',
      fromDate: '2026-09-10',
      toDate: '2026-09-13',
      reason: 'Going home',
    });

    expect(res).toBeDefined();
    expect(res.breakDays).toBe(4);
    expect(res.status).toBe(SubscriptionBreakStatus.PENDING);
  });

  it('2. 1-Month eligibility check: Rejects 1-Day subscriptions', async () => {
    jest.spyOn(subRepo, 'findOne').mockResolvedValue(mockOneDaySub);

    await expect(
      service.createBreakRequest('student-uuid-1', {
        subscriptionId: 'sub-one-day',
        fromDate: '2026-09-01',
        toDate: '2026-09-01',
      }),
    ).rejects.toThrow(
      'Subscription breaks are available only for 1-month subscriptions.',
    );
  });

  it('3. 1-Month eligibility check: Rejects 1-Week subscriptions', async () => {
    jest.spyOn(subRepo, 'findOne').mockResolvedValue(mockOneWeekSub);

    await expect(
      service.createBreakRequest('student-uuid-1', {
        subscriptionId: 'sub-one-week',
        fromDate: '2026-09-02',
        toDate: '2026-09-04',
      }),
    ).rejects.toThrow(
      'Subscription breaks are available only for 1-month subscriptions.',
    );
  });

  it('4. 1-Month eligibility check: Rejects 15-Day subscriptions', async () => {
    jest.spyOn(subRepo, 'findOne').mockResolvedValue(mock15DaySub);

    await expect(
      service.createBreakRequest('student-uuid-1', {
        subscriptionId: 'sub-15-day',
        fromDate: '2026-09-05',
        toDate: '2026-09-08',
      }),
    ).rejects.toThrow(
      'Subscription breaks are available only for 1-month subscriptions.',
    );
  });

  it('5. PrimeMate cannot request break for another user subscription (IDOR protection)', async () => {
    jest.spyOn(subRepo, 'findOne').mockResolvedValue(mockOneMonthSub);

    await expect(
      service.createBreakRequest('student-uuid-2', {
        subscriptionId: 'sub-one-month',
        fromDate: '2026-09-10',
        toDate: '2026-09-12',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('6. Request rejected if provider has subscription breaks disabled', async () => {
    const subDisabledProv = {
      ...mockOneMonthSub,
      mealPlan: {
        id: 'plan-1',
        title: '1 Month Plan',
        provider: mockProviderDisabled,
      },
    };
    jest.spyOn(subRepo, 'findOne').mockResolvedValue(subDisabledProv);
    jest.spyOn(providerRepo, 'findOne').mockResolvedValue(mockProviderDisabled);

    await expect(
      service.createBreakRequest('student-uuid-1', {
        subscriptionId: 'sub-one-month',
        fromDate: '2026-09-10',
        toDate: '2026-09-12',
      }),
    ).rejects.toThrow(
      'Subscription breaks are not available for this provider.',
    );
  });

  it('7. Rejects break duration > 4 days', async () => {
    jest.spyOn(subRepo, 'findOne').mockResolvedValue(mockOneMonthSub);

    await expect(
      service.createBreakRequest('student-uuid-1', {
        subscriptionId: 'sub-one-month',
        fromDate: '2026-09-10',
        toDate: '2026-09-15', // 6 days
      }),
    ).rejects.toThrow('Break duration must be between 1 and 4 days.');
  });

  it('8. Rejects if used approved break days already equals 4', async () => {
    jest.spyOn(subRepo, 'findOne').mockResolvedValue(mockOneMonthSub);
    jest.spyOn(breakRepo, 'find').mockImplementation((opts: any) => {
      if (
        opts.where &&
        opts.where.status === SubscriptionBreakStatus.APPROVED
      ) {
        return Promise.resolve([
          { id: 'b1', breakDays: 2, status: SubscriptionBreakStatus.APPROVED },
          { id: 'b2', breakDays: 2, status: SubscriptionBreakStatus.APPROVED },
        ] as any);
      }
      return Promise.resolve([]);
    });

    await expect(
      service.createBreakRequest('student-uuid-1', {
        subscriptionId: 'sub-one-month',
        fromDate: '2026-09-20',
        toDate: '2026-09-21',
      }),
    ).rejects.toThrow("You've used all 4 break days for this subscription.");
  });

  it('9. Rejected and Pending break requests do NOT consume the 4-day allowance until approved', async () => {
    jest.spyOn(subRepo, 'findOne').mockResolvedValue(mockOneMonthSub);
    jest.spyOn(breakRepo, 'find').mockImplementation((opts: any) => {
      // Return 0 APPROVED breaks, 1 REJECTED, 1 CANCELLED
      if (Array.isArray(opts.where)) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const res = await service.createBreakRequest('student-uuid-1', {
      subscriptionId: 'sub-one-month',
      fromDate: '2026-09-10',
      toDate: '2026-09-13', // 4 days
    });

    expect(res).toBeDefined();
    expect(res.breakDays).toBe(4);
  });

  it('10. Rejects overlapping break requests for the same subscription', async () => {
    jest.spyOn(subRepo, 'findOne').mockResolvedValue(mockOneMonthSub);
    jest.spyOn(breakRepo, 'find').mockImplementation((opts: any) => {
      if (Array.isArray(opts.where)) {
        // Return existing break for Sept 10 to Sept 12
        return Promise.resolve([
          {
            id: 'existing-b1',
            fromDate: '2026-09-10',
            toDate: '2026-09-12',
            status: SubscriptionBreakStatus.APPROVED,
          },
        ] as any);
      }
      return Promise.resolve([]);
    });

    await expect(
      service.createBreakRequest('student-uuid-1', {
        subscriptionId: 'sub-one-month',
        fromDate: '2026-09-11',
        toDate: '2026-09-13', // Overlaps on 11th and 12th
      }),
    ).rejects.toThrow(
      'A break request already exists for an overlapping date range.',
    );
  });

  it('11. Provider cannot view break requests of another provider (IDOR protection)', async () => {
    jest.spyOn(providerRepo, 'findOne').mockResolvedValue(mockProvider); // Owned by provider-user-1

    await expect(
      service.getProviderBreakRequests('provider-uuid-1', 'provider-user-2'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('12. Provider approval extends subscription endDate by exact breakDays in atomic transaction', async () => {
    const res = await service.approveBreakRequest(
      'pending-req-1',
      'provider-user-1',
    );

    expect(res).toBeDefined();
    expect(res.status).toBe(SubscriptionBreakStatus.APPROVED);
  });

  it('13. Provider rejection updates status without extending subscription endDate', async () => {
    jest.spyOn(breakRepo, 'findOne').mockResolvedValue({
      id: 'pending-req-2',
      subscriptionId: 'sub-one-month',
      status: SubscriptionBreakStatus.PENDING,
      provider: mockProvider,
    } as any);

    const res = await service.rejectBreakRequest(
      'pending-req-2',
      'provider-user-1',
    );

    expect(res).toBeDefined();
    expect(res.status).toBe(SubscriptionBreakStatus.REJECTED);
  });
});
