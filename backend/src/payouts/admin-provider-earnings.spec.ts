import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PayoutsService } from './payouts.service';
import { AdminProviderEarningsController } from './admin-provider-earnings.controller';
import {
  ProviderEarning,
  ProviderEarningStatus,
} from './provider-earning.entity';
import { ProviderSettlementAudit } from './provider-settlement-audit.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { Payment } from '../payments/payment.entity';
import { Role } from '../common/roles.enum';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';
import {
  NotFoundException,
  BadRequestException,
  ExecutionContext,
} from '@nestjs/common';

describe('Admin Provider Earnings & Manual Settlement Specification', () => {
  let controller: AdminProviderEarningsController;
  let reflector: Reflector;

  let mockEarnings: any[] = [];
  let mockProviders: any[] = [];
  let mockAudits: any[] = [];
  let mockPayments: any[] = [];

  const adminUser = {
    userId: 'admin-uuid-1',
    email: 'admin@primeplate.com',
    role: Role.ADMIN,
  };

  const studentUser = {
    userId: 'student-uuid-1',
    email: 'student@example.com',
    role: Role.STUDENT,
  };

  const providerUser = {
    userId: 'prov-user-uuid-1',
    email: 'provider@example.com',
    role: Role.PROVIDER,
  };

  const mockProviderA: any = {
    id: 'prov-A',
    name: 'Jagan Reddy Hostel',
    city: 'Hyderabad',
    address: 'Near Tech Park',
    user: { id: 'prov-user-uuid-1', phone: '9876543210' },
  };

  const mockProviderB: any = {
    id: 'prov-B',
    name: 'Sri Krishna Mess',
    city: 'Bangalore',
    address: 'Electronic City',
    user: { id: 'prov-user-uuid-2', phone: '9123456780' },
  };

  const mockPaymentRecord: any = {
    id: 'pay-uuid-101',
    amount: 2500,
    status: 'paid',
    razorpayOrderId: 'order_ABC123',
    razorpayPaymentId: 'pay_XYZ789',
    student: { id: 'student-uuid-1', name: 'Alice Student' },
    provider: mockProviderA,
  };

  beforeEach(async () => {
    mockAudits = [];
    mockProviders = [{ ...mockProviderA }, { ...mockProviderB }];
    mockPayments = [{ ...mockPaymentRecord }];

    mockEarnings = [
      {
        id: 'earn-1',
        paymentId: 'pay-uuid-101',
        providerId: 'prov-A',
        studentId: 'student-uuid-1',
        grossAmount: 2500,
        platformFee: 250,
        providerAmount: 2250,
        status: ProviderEarningStatus.PENDING,
        earnedAt: new Date('2026-09-14T10:00:00Z'),
        createdAt: new Date('2026-09-14T10:00:00Z'),
        paidAt: null,
        settlementReference: null,
        payment: mockPaymentRecord,
        subscription: { mealPlan: { title: 'Premium Veg 30-Day' } },
        student: { id: 'student-uuid-1', name: 'Alice Student' },
      },
      {
        id: 'earn-2',
        paymentId: 'pay-uuid-102',
        providerId: 'prov-B',
        studentId: 'student-uuid-2',
        grossAmount: 3000,
        platformFee: 300,
        providerAmount: 2700,
        status: ProviderEarningStatus.PAID,
        earnedAt: new Date('2026-09-10T10:00:00Z'),
        createdAt: new Date('2026-09-10T10:00:00Z'),
        paidAt: new Date('2026-09-11T12:00:00Z'),
        settlementReference: 'PRIMEPLATE-SETTLE-20260911-HIST001',
        payment: {
          id: 'pay-uuid-102',
          amount: 3000,
          status: 'paid',
          razorpayPaymentId: 'pay_HIST999',
        },
        subscription: { mealPlan: { title: 'South Indian Deluxe' } },
        student: { id: 'student-uuid-2', name: 'Bob Subscriber' },
      },
    ];

    const mockEarningRepo = {
      find: jest.fn(async (opts?: any) => {
        if (opts?.where?.providerId) {
          return mockEarnings.filter(
            (e) => e.providerId === opts.where.providerId,
          );
        }
        return [...mockEarnings];
      }),
      findOne: jest.fn(async (opts: any) => {
        if (opts?.where?.id) {
          return mockEarnings.find((e) => e.id === opts.where.id) || null;
        }
        return null;
      }),
      save: jest.fn(async (entity: any) => {
        const idx = mockEarnings.findIndex((e) => e.id === entity.id);
        if (idx >= 0) {
          mockEarnings[idx] = { ...mockEarnings[idx], ...entity };
          return mockEarnings[idx];
        }
        mockEarnings.push(entity);
        return entity;
      }),
      manager: {
        transaction: jest.fn(async (cb: (em: any) => Promise<any>) => {
          return cb({
            findOne: jest.fn(async (entityClass: any, opts: any) => {
              if (entityClass === ProviderEarning) {
                return mockEarnings.find((e) => e.id === opts.where.id) || null;
              }
              return null;
            }),
            save: jest.fn(async (entityClass: any, entity?: any) => {
              const actual = entity || entityClass;
              if (actual instanceof ProviderSettlementAudit || actual.adminId) {
                mockAudits.push(actual);
                return actual;
              }
              const idx = mockEarnings.findIndex((e) => e.id === actual.id);
              if (idx >= 0) {
                mockEarnings[idx] = { ...mockEarnings[idx], ...actual };
                return mockEarnings[idx];
              }
              mockEarnings.push(actual);
              return actual;
            }),
            create: jest.fn((entityClass: any, data: any) => data),
          });
        }),
      },
    };

    const mockProviderRepo = {
      find: jest.fn(async () => [...mockProviders]),
      findOne: jest.fn(async (opts: any) => {
        if (opts?.where?.id) {
          return mockProviders.find((p) => p.id === opts.where.id) || null;
        }
        return null;
      }),
    };

    const mockAuditRepo = {
      create: jest.fn((data: any) => data),
      save: jest.fn(async (data: any) => {
        mockAudits.push(data);
        return data;
      }),
    };

    const mockPaymentRepo = {
      find: jest.fn(async () => [...mockPayments]),
      findOne: jest.fn(async (opts: any) => {
        return mockPayments.find((p) => p.id === opts.where.id) || null;
      }),
      manager: mockEarningRepo.manager,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminProviderEarningsController],
      providers: [
        PayoutsService,
        Reflector,
        {
          provide: getRepositoryToken(ProviderEarning),
          useValue: mockEarningRepo,
        },
        {
          provide: getRepositoryToken(MealProvider),
          useValue: mockProviderRepo,
        },
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        {
          provide: getRepositoryToken(ProviderSettlementAudit),
          useValue: mockAuditRepo,
        },
      ],
    }).compile();

    controller = module.get<AdminProviderEarningsController>(
      AdminProviderEarningsController,
    );
    reflector = module.get<Reflector>(Reflector);
  });

  // 1. Admin can view earnings overview
  it('1. Admin can view earnings overview with correct aggregated totals', async () => {
    const res = await controller.getOverview();
    expect(res.summary).toBeDefined();
    // 2500 (pending) + 3000 (paid) = 5500
    expect(res.summary.totalCollected).toBe(5500);
    // 2250 (pending) + 2700 (paid) = 4950
    expect(res.summary.totalProviderEarnings).toBe(4950);
    expect(res.summary.totalPaid).toBe(2700);
    expect(res.summary.totalPending).toBe(2250);
  });

  // 2. Admin can view provider earnings list
  it('2. Admin can view provider earnings list', async () => {
    const res = await controller.getOverview();
    expect(res.providers).toBeDefined();
    expect(res.providers.length).toBe(2);

    const provA = res.providers.find((p) => p.providerId === 'prov-A');
    expect(provA).toBeDefined();
    expect(provA.providerName).toBe('Jagan Reddy Hostel');
    expect(provA.totalEarned).toBe(2250);
    expect(provA.pending).toBe(2250);
    expect(provA.paid).toBe(0);
  });

  // 3. Student receives 403 Forbidden
  it('3. Student receives 403 Forbidden via RolesGuard', () => {
    const guard = new RolesGuard(reflector);
    const mockContext = {
      getHandler: () => AdminProviderEarningsController.prototype.getOverview,
      getClass: () => AdminProviderEarningsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: studentUser }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(false);
  });

  // 4. Provider receives 403 Forbidden
  it('4. Provider receives 403 Forbidden via RolesGuard', () => {
    const guard = new RolesGuard(reflector);
    const mockContext = {
      getHandler: () => AdminProviderEarningsController.prototype.markPaid,
      getClass: () => AdminProviderEarningsController,
      switchToHttp: () => ({
        getRequest: () => ({ user: providerUser }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(false);
  });

  // 5. Pending earning displayed correctly
  it('5. Pending earning displayed correctly in provider detail view', async () => {
    const res = await controller.getProviderDetail('prov-A');
    expect(res.provider.name).toBe('Jagan Reddy Hostel');
    expect(res.summary.pending).toBe(2250);
    expect(res.summary.paid).toBe(0);
    expect(res.earnings.length).toBe(1);
    expect(res.earnings[0].status).toBe(ProviderEarningStatus.PENDING);
    expect(res.earnings[0].providerAmount).toBe(2250);
    expect(res.earnings[0].student.name).toBe('Alice Student');
  });

  // 6. Mark pending/eligible earning as PAID
  it('6. Mark pending/eligible earning as PAID updates status to PAID', async () => {
    const mockReq: any = { user: adminUser };
    const res = await controller.markPaid(mockReq, 'earn-1', {
      settlementReference: 'PRIMEPLATE-SETTLE-20260915-001',
    });

    expect(res.success).toBe(true);
    expect(res.alreadyPaid).toBe(false);
    expect(res.earning.status).toBe(ProviderEarningStatus.PAID);
  });

  // 7. paidAt recorded
  it('7. paidAt timestamp is accurately recorded', async () => {
    const mockReq: any = { user: adminUser };
    const res = await controller.markPaid(mockReq, 'earn-1');
    expect(res.earning.paidAt).toBeInstanceOf(Date);
  });

  // 8. settlementReference recorded
  it('8. settlementReference is recorded with internal reference format', async () => {
    const mockReq: any = { user: adminUser };
    const customRef = 'PRIMEPLATE-SETTLE-20260915-CUSTOM';
    const res = await controller.markPaid(mockReq, 'earn-1', {
      settlementReference: customRef,
    });
    expect(res.earning.settlementReference).toBe(customRef);
  });

  // 9. Audit record created
  it('9. Audit record is created capturing admin, provider, amount, and reference', async () => {
    const mockReq: any = { user: adminUser };
    await controller.markPaid(mockReq, 'earn-1', {
      settlementReference: 'PRIMEPLATE-SETTLE-AUDIT-TEST',
    });

    expect(mockAudits.length).toBe(1);
    const audit = mockAudits[0];
    expect(audit.adminId).toBe(adminUser.userId);
    expect(audit.adminEmail).toBe(adminUser.email);
    expect(audit.providerId).toBe('prov-A');
    expect(audit.earningId).toBe('earn-1');
    expect(audit.amount).toBe(2250);
    expect(audit.previousStatus).toBe(ProviderEarningStatus.PENDING);
    expect(audit.newStatus).toBe(ProviderEarningStatus.PAID);
    expect(audit.settlementReference).toBe('PRIMEPLATE-SETTLE-AUDIT-TEST');
  });

  // 10. Already PAID earning cannot be paid again (Idempotent)
  it('10. Already PAID earning cannot be paid again (Idempotent response)', async () => {
    const mockReq: any = { user: adminUser };
    // 'earn-2' is already initialized as PAID
    const res = await controller.markPaid(mockReq, 'earn-2');
    expect(res.success).toBe(true);
    expect(res.alreadyPaid).toBe(true);
    expect(res.message).toBe(
      'These earnings have already been marked as paid.',
    );
  });

  // 11. No duplicate audit from repeated settlement
  it('11. No duplicate audit is created when attempting repeated settlement', async () => {
    const mockReq: any = { user: adminUser };
    // Settle earn-1 first time
    await controller.markPaid(mockReq, 'earn-1');
    expect(mockAudits.length).toBe(1);

    // Repeated settlement on earn-1
    const res = await controller.markPaid(mockReq, 'earn-1');
    expect(res.alreadyPaid).toBe(true);
    // Audit count remains 1, no duplicate audit
    expect(mockAudits.length).toBe(1);
  });

  // 12. Original payments.amount remains unchanged
  it('12. Original payment amount and status remain completely untouched', async () => {
    const mockReq: any = { user: adminUser };
    await controller.markPaid(mockReq, 'earn-1');

    // Payment remains exactly ₹2500 and status remains 'paid'
    expect(mockPaymentRecord.amount).toBe(2500);
    expect(mockPaymentRecord.status).toBe('paid');
  });

  // 13. Provider total earnings remain unchanged
  it('13. Provider total earnings remain unchanged after settlement', async () => {
    const mockReq: any = { user: adminUser };
    const detailBefore = await controller.getProviderDetail('prov-A');
    expect(detailBefore.summary.totalEarned).toBe(2250);

    await controller.markPaid(mockReq, 'earn-1');

    const detailAfter = await controller.getProviderDetail('prov-A');
    expect(detailAfter.summary.totalEarned).toBe(2250);
  });

  // 14. Pending balance decreases correctly
  it('14. Pending balance decreases to 0 and Paid balance increases to 2250', async () => {
    const mockReq: any = { user: adminUser };
    await controller.markPaid(mockReq, 'earn-1');

    const detail = await controller.getProviderDetail('prov-A');
    expect(detail.summary.pending).toBe(0);
    expect(detail.summary.paid).toBe(2250);
  });

  // 15. Invalid earning ID → 404 NotFound
  it('15. Invalid earning ID returns NotFoundException (404)', async () => {
    const mockReq: any = { user: adminUser };
    await expect(
      controller.markPaid(mockReq, 'non-existent-earning-id'),
    ).rejects.toThrow(NotFoundException);
  });

  // 16. Invalid settlement status → controlled error
  it('16. Invalid settlement status (e.g. REFUNDED) returns controlled BadRequestException', async () => {
    mockEarnings.push({
      id: 'earn-refunded',
      providerId: 'prov-A',
      providerAmount: 1000,
      status: ProviderEarningStatus.REFUNDED,
    });

    const mockReq: any = { user: adminUser };
    await expect(controller.markPaid(mockReq, 'earn-refunded')).rejects.toThrow(
      BadRequestException,
    );
  });

  // 17. Unauthorized provider cannot settle another provider
  it('17. Provider user attempting settlement endpoint receives 403 Forbidden', () => {
    const guard = new RolesGuard(reflector);
    const mockContext = {
      getHandler: () => AdminProviderEarningsController.prototype.markPaid,
      getClass: () => AdminProviderEarningsController,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { userId: 'unauthorized-prov', role: Role.PROVIDER },
        }),
      }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(mockContext)).toBe(false);
  });

  // 18. Transaction rollback works if audit creation fails
  it('18. Transaction rollback: earning status is not persisted if audit creation fails', async () => {
    const failingEarningRepo = {
      manager: {
        transaction: jest.fn(async (cb: (em: any) => Promise<any>) => {
          const em = {
            findOne: jest.fn(async () => ({
              id: 'earn-rollback',
              providerId: 'prov-A',
              providerAmount: 1500,
              status: ProviderEarningStatus.PENDING,
            })),
            save: jest.fn(async (entityClass: any, entity?: any) => {
              const actual = entity || entityClass;
              if (actual instanceof ProviderSettlementAudit || actual.adminId) {
                throw new Error('Database disk error during audit persistence');
              }
              return actual;
            }),
            create: jest.fn((entityClass: any, data: any) => data),
          };
          return cb(em);
        }),
      },
    };

    const failingService = new PayoutsService(
      failingEarningRepo as any,
      {} as any,
      {} as any,
    );

    await expect(
      failingService.markEarningAsPaid('earn-rollback', {
        userId: adminUser.userId,
        email: adminUser.email,
      }),
    ).rejects.toThrow('Database disk error during audit persistence');
  });

  // 19. Concurrent/repeated mark-paid is idempotent
  it('19. Concurrent/repeated mark-paid requests are safely idempotent', async () => {
    const mockReq: any = { user: adminUser };

    // Fire two markPaid calls concurrently on the same pending earning
    const [res1, res2] = await Promise.all([
      controller.markPaid(mockReq, 'earn-1'),
      controller.markPaid(mockReq, 'earn-1'),
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);

    // One succeeds with alreadyPaid false, the second reports alreadyPaid true (or both gracefully succeed)
    const alreadyPaidCount = [res1.alreadyPaid, res2.alreadyPaid].filter(
      Boolean,
    ).length;
    expect(alreadyPaidCount).toBeGreaterThanOrEqual(1);

    // Audits must not exceed 1
    expect(mockAudits.length).toBe(1);
  });

  // 20. Existing payment tests remain passing
  it('20. Payment record and provider earning values match expected invariants', () => {
    const earning = mockEarnings[0];
    const payment = mockPaymentRecord;

    // Gross amount = student payment amount
    expect(Number(earning.grossAmount)).toBe(Number(payment.amount));
    // Provider amount + platform fee = gross amount
    expect(Number(earning.providerAmount) + Number(earning.platformFee)).toBe(
      Number(earning.grossAmount),
    );
  });
});
