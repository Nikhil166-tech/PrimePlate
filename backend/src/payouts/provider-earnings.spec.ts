import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PayoutsService } from './payouts.service';
import {
  ProviderEarning,
  ProviderEarningStatus,
} from './provider-earning.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { Payment } from '../payments/payment.entity';
import { PaymentWebhookEvent } from '../payments/webhook-event.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { User } from '../users/user.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';
import { PaymentsService } from '../payments/payments.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

describe('Provider Earnings & Payout Ledger Specification', () => {
  let payoutsService: PayoutsService;
  let paymentsService: PaymentsService;

  const secret = 'secret_123';
  const makeSig = (payload: string) =>
    crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const mockStudent1: any = {
    id: 'student-1',
    name: 'PrimeMate One',
    role: 'STUDENT',
  };
  const mockStudent2: any = {
    id: 'student-2',
    name: 'PrimeMate Two',
    role: 'STUDENT',
  };

  const mockUserProviderA: any = { id: 'user-prov-A', role: 'PROVIDER' };
  const mockUserProviderB: any = { id: 'user-prov-B', role: 'PROVIDER' };

  const mockProviderA: any = {
    id: 'prov-A',
    name: 'Sri Lakshmi Mess',
    monthlyPrice: 3000,
    user: mockUserProviderA,
    approvalStatus: 'APPROVED',
    acceptingSubscriptions: true,
    totalCapacity: 50,
  };

  const mockProviderB: any = {
    id: 'prov-B',
    name: 'Annapurna Mess',
    monthlyPrice: 2500,
    user: mockUserProviderB,
    approvalStatus: 'APPROVED',
    acceptingSubscriptions: true,
    totalCapacity: 50,
  };

  const mockPlanA: any = {
    id: 'plan-A',
    title: '1 Month Plan',
    pricePerMonth: 3000,
    durationDays: 30,
    provider: mockProviderA,
  };

  let mockEarningsStore: any[] = [];
  let mockPaymentsStore: any[] = [];
  let mockSubscriptionsStore: any[] = [];

  beforeEach(async () => {
    mockEarningsStore = [];
    mockPaymentsStore = [];
    mockSubscriptionsStore = [];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutsService,
        PaymentsService,
        SubscriptionsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_123';
              if (key === 'RAZORPAY_KEY_SECRET') return secret;
              if (key === 'RAZORPAY_WEBHOOK_SECRET') return secret;
              return null;
            }),
          },
        },
        {
          provide: getRepositoryToken(PaymentWebhookEvent),
          useValue: {
            create: jest
              .fn()
              .mockImplementation((d) => ({ ...d, id: `we_${Date.now()}` })),
            save: jest.fn().mockImplementation((d) => Promise.resolve(d)),
          },
        },
        {
          provide: getRepositoryToken(ProviderEarning),
          useValue: {
            find: jest.fn().mockImplementation((opts) => {
              let res = [...mockEarningsStore];
              if (opts?.where?.providerId) {
                res = res.filter((e) => e.providerId === opts.where.providerId);
              }
              if (opts?.where?.paymentId) {
                res = res.filter((e) => e.paymentId === opts.where.paymentId);
              }
              return Promise.resolve(res);
            }),
            findOne: jest.fn().mockImplementation((opts) => {
              let res = [...mockEarningsStore];
              if (opts?.where?.paymentId) {
                res = res.filter((e) => e.paymentId === opts.where.paymentId);
              }
              if (opts?.where?.id) {
                res = res.filter((e) => e.id === opts.where.id);
              }
              return Promise.resolve(res[0] || null);
            }),
            create: jest.fn().mockImplementation((dto) => {
              return {
                id: `earning-${Date.now()}-${Math.random()}`,
                createdAt: new Date(),
                updatedAt: new Date(),
                ...dto,
              };
            }),
            save: jest.fn().mockImplementation((entity) => {
              const idx = mockEarningsStore.findIndex(
                (e) => e.id === entity.id || e.paymentId === entity.paymentId,
              );
              if (idx >= 0) {
                mockEarningsStore[idx] = {
                  ...mockEarningsStore[idx],
                  ...entity,
                };
                return Promise.resolve(mockEarningsStore[idx]);
              }
              mockEarningsStore.push(entity);
              return Promise.resolve(entity);
            }),
          },
        },
        {
          provide: getRepositoryToken(MealProvider),
          useValue: {
            findOne: jest.fn().mockImplementation((opts) => {
              if (opts?.where?.user?.id === 'user-prov-A')
                return Promise.resolve(mockProviderA);
              if (opts?.where?.user?.id === 'user-prov-B')
                return Promise.resolve(mockProviderB);
              if (opts?.where?.id === 'prov-A')
                return Promise.resolve(mockProviderA);
              if (opts?.where?.id === 'prov-B')
                return Promise.resolve(mockProviderB);
              return Promise.resolve(null);
            }),
          },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            find: jest.fn().mockImplementation((opts) => {
              let res = [...mockPaymentsStore];
              if (opts?.where?.status) {
                res = res.filter((p) => p.status === opts.where.status);
              }
              return Promise.resolve(res);
            }),
            findOne: jest.fn().mockImplementation((opts) => {
              if (Array.isArray(opts?.where)) {
                for (const w of opts.where) {
                  const found = mockPaymentsStore.find(
                    (p) =>
                      (w.razorpayOrderId &&
                        p.razorpayOrderId === w.razorpayOrderId) ||
                      (w.razorpayPaymentId &&
                        p.razorpayPaymentId === w.razorpayPaymentId) ||
                      (w.id && p.id === w.id),
                  );
                  if (found) return Promise.resolve(found);
                }
                return Promise.resolve(null);
              }
              if (opts?.where?.id) {
                return Promise.resolve(
                  mockPaymentsStore.find((p) => p.id === opts.where.id) || null,
                );
              }
              return Promise.resolve(null);
            }),
            create: jest.fn().mockImplementation((dto) => ({
              id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              createdAt: new Date(),
              ...dto,
            })),
            save: jest.fn().mockImplementation((entity) => {
              const idx = mockPaymentsStore.findIndex(
                (p) => p.id === entity.id,
              );
              if (idx >= 0) {
                mockPaymentsStore[idx] = {
                  ...mockPaymentsStore[idx],
                  ...entity,
                };
                return Promise.resolve(mockPaymentsStore[idx]);
              }
              mockPaymentsStore.push(entity);
              return Promise.resolve(entity);
            }),
            manager: (() => {
              const managerMock: any = {
                connection: { options: { type: 'better-sqlite3' } },
                findOne: jest.fn().mockImplementation((entityClass, opts) => {
                  if (entityClass === Payment) {
                    if (Array.isArray(opts?.where)) {
                      for (const w of opts.where) {
                        const found = mockPaymentsStore.find(
                          (p) =>
                            (w.razorpayOrderId &&
                              p.razorpayOrderId === w.razorpayOrderId) ||
                            (w.razorpayPaymentId &&
                              p.razorpayPaymentId === w.razorpayPaymentId) ||
                            (w.id && p.id === w.id),
                        );
                        if (found) return Promise.resolve(found);
                      }
                      return Promise.resolve(null);
                    }
                    return Promise.resolve(
                      mockPaymentsStore.find((p) => p.id === opts?.where?.id) ||
                        null,
                    );
                  }
                  if (entityClass === User)
                    return Promise.resolve(mockStudent1);
                  if (entityClass === MealPlan)
                    return Promise.resolve(mockPlanA);
                  if (entityClass === MealProvider)
                    return Promise.resolve(mockProviderA);
                  if (entityClass === ProviderEarning) {
                    return Promise.resolve(
                      mockEarningsStore.find(
                        (e) => e.paymentId === opts?.where?.paymentId,
                      ) || null,
                    );
                  }
                  return Promise.resolve(null);
                }),
                find: jest.fn().mockImplementation((entityClass, opts) => {
                  if (entityClass === Subscription) {
                    let res = [...mockSubscriptionsStore];
                    if (opts?.where?.student?.id) {
                      res = res.filter(
                        (s) => s.student?.id === opts.where.student.id,
                      );
                    }
                    return Promise.resolve(res);
                  }
                  if (entityClass === Payment) {
                    let res = [...mockPaymentsStore];
                    if (opts?.where?.status) {
                      res = res.filter((p) => p.status === opts.where.status);
                    }
                    return Promise.resolve(res);
                  }
                  if (entityClass === ProviderEarning) {
                    let res = [...mockEarningsStore];
                    if (opts?.where?.providerId) {
                      res = res.filter(
                        (e) => e.providerId === opts.where.providerId,
                      );
                    }
                    return Promise.resolve(res);
                  }
                  return Promise.resolve([]);
                }),
                count: jest.fn().mockResolvedValue(0),
                create: jest.fn().mockImplementation((entityClass, dto) => ({
                  id: `id-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  ...dto,
                })),
                save: jest.fn().mockImplementation((entityClass, entity) => {
                  const target = entity !== undefined ? entity : entityClass;
                  if (target.grossAmount !== undefined) {
                    const idx = mockEarningsStore.findIndex(
                      (e) =>
                        e.id === target.id || e.paymentId === target.paymentId,
                    );
                    if (idx >= 0) {
                      mockEarningsStore[idx] = {
                        ...mockEarningsStore[idx],
                        ...target,
                      };
                    } else {
                      mockEarningsStore.push(target);
                    }
                  } else if (
                    target.razorpayPaymentId ||
                    target.status === 'paid' ||
                    target.status === 'refunded'
                  ) {
                    const idx = mockPaymentsStore.findIndex(
                      (p) =>
                        p.id === target.id ||
                        (target.razorpayPaymentId &&
                          p.razorpayPaymentId === target.razorpayPaymentId),
                    );
                    if (idx >= 0) {
                      mockPaymentsStore[idx] = {
                        ...mockPaymentsStore[idx],
                        ...target,
                      };
                    } else {
                      mockPaymentsStore.push(target);
                    }
                  } else if (target.startDate) {
                    const idx = mockSubscriptionsStore.findIndex(
                      (s) => s.id === target.id,
                    );
                    if (idx >= 0) {
                      mockSubscriptionsStore[idx] = {
                        ...mockSubscriptionsStore[idx],
                        ...target,
                      };
                    } else {
                      mockSubscriptionsStore.push(target);
                    }
                  }
                  return Promise.resolve(target);
                }),
              };
              managerMock.transaction = jest
                .fn()
                .mockImplementation((cb) => cb(managerMock));
              return managerMock;
            })(),
          },
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: {
            find: jest
              .fn()
              .mockImplementation(() =>
                Promise.resolve(mockSubscriptionsStore),
              ),
            manager: {
              find: jest.fn().mockImplementation((entityClass, opts) => {
                if (entityClass === Payment) {
                  let res = [...mockPaymentsStore];
                  if (opts?.where?.student?.id) {
                    res = res.filter(
                      (p) => p.student?.id === opts.where.student.id,
                    );
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
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockStudent1),
          },
        },
        {
          provide: getRepositoryToken(MealPlan),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockPlanA),
          },
        },
      ],
    }).compile();

    payoutsService = module.get<PayoutsService>(PayoutsService);
    paymentsService = module.get<PaymentsService>(PaymentsService);
  });

  it('1. Paid payment creates ProviderEarning record', async () => {
    const res = await paymentsService.processVerifiedPayment({
      userId: 'student-1',
      razorpayOrderId: 'order_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: makeSig('order_1|pay_1'),
      mealPlanId: 'plan-A',
      durationInput: 30,
    });

    expect(res.success).toBe(true);
    expect(mockEarningsStore.length).toBe(1);
    expect(mockEarningsStore[0].grossAmount).toBe(3000);
    expect(mockEarningsStore[0].status).toBe(ProviderEarningStatus.PENDING);
  });

  it('2. Failed payment creates no provider earning', async () => {
    const failedPayment: any = {
      id: 'pay-failed-1',
      amount: 3000,
      status: 'failed',
      student: mockStudent1,
      provider: mockProviderA,
    };

    const earning = await payoutsService.createEarningForPayment(
      failedPayment,
      'sub-failed',
    );
    expect(earning).toBeNull();
    expect(mockEarningsStore.length).toBe(0);
  });

  it('3. Unverified payment creates no provider earning', async () => {
    const unverifiedPayment: any = {
      id: 'pay-unverified',
      amount: 3000,
      status: 'created',
      student: mockStudent1,
      provider: mockProviderA,
    };

    const earning = await payoutsService.createEarningForPayment(
      unverifiedPayment,
      'sub-unverified',
    );
    expect(earning).toBeNull();
    expect(mockEarningsStore.length).toBe(0);
  });

  it('4. Duplicate verification creates no duplicate earning (idempotency)', async () => {
    const sig = makeSig('order_dup|pay_dup');
    // First verification
    await paymentsService.processVerifiedPayment({
      userId: 'student-1',
      razorpayOrderId: 'order_dup',
      razorpayPaymentId: 'pay_dup',
      razorpaySignature: sig,
      mealPlanId: 'plan-A',
      durationInput: 30,
    });

    const countFirst = mockEarningsStore.length;
    expect(countFirst).toBe(1);

    // Second verification replay
    const resDup = await paymentsService.processVerifiedPayment({
      userId: 'student-1',
      razorpayOrderId: 'order_dup',
      razorpayPaymentId: 'pay_dup',
      razorpaySignature: sig,
      mealPlanId: 'plan-A',
      durationInput: 30,
    });

    expect(resDup.idempotent).toBe(true);
    expect(mockEarningsStore.length).toBe(1);
  });

  it('5. Duplicate webhook creates no duplicate earning', async () => {
    const webhookBody = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_wh_1',
            order_id: 'order_wh_1',
            notes: { mealPlanId: 'plan-A', userId: 'student-1' },
          },
        },
      },
    };

    const rawBody = JSON.stringify(webhookBody);
    const sig = 'sig_test_wh';

    await paymentsService.handleWebhook(rawBody, sig, webhookBody);
    expect(mockEarningsStore.length).toBe(1);

    // Repeated webhook event
    await paymentsService.handleWebhook(rawBody, sig, webhookBody);
    expect(mockEarningsStore.length).toBe(1);
  });

  it('6. Payment amount is copied exactly into ProviderEarning', async () => {
    const payObj: any = {
      id: 'pay-custom-amount',
      amount: 933,
      status: 'paid',
      student: mockStudent1,
      provider: mockProviderA,
    };

    const earning = await payoutsService.createEarningForPayment(
      payObj,
      'sub-custom',
    );
    expect(earning?.grossAmount).toBe(933);
  });

  it('7. platformFee is 0 under current commission model', async () => {
    const payObj: any = {
      id: 'pay-fee-check',
      amount: 3000,
      status: 'paid',
      student: mockStudent1,
      provider: mockProviderA,
    };

    const earning = await payoutsService.createEarningForPayment(
      payObj,
      'sub-fee',
    );
    expect(earning?.platformFee).toBe(0);
  });

  it('8. providerAmount equals grossAmount', async () => {
    const payObj: any = {
      id: 'pay-prov-amt-check',
      amount: 3000,
      status: 'paid',
      student: mockStudent1,
      provider: mockProviderA,
    };

    const earning = await payoutsService.createEarningForPayment(
      payObj,
      'sub-amt',
    );
    expect(earning?.providerAmount).toBe(3000);
    expect(earning?.providerAmount).toBe(earning?.grossAmount);
  });

  it('9. Provider price change does NOT alter historical earning amount', async () => {
    const payObj: any = {
      id: 'pay-historical-1',
      amount: 3000,
      status: 'paid',
      student: mockStudent1,
      provider: mockProviderA,
    };

    const earning = await payoutsService.createEarningForPayment(
      payObj,
      'sub-hist-1',
    );
    expect(earning?.providerAmount).toBe(3000);

    // Provider updates current monthly price to ₹3,500
    mockProviderA.monthlyPrice = 3500;
    mockPlanA.pricePerMonth = 3500;

    const summary = await payoutsService.getProviderSummary('user-prov-A');
    expect(summary.totalProviderEarnings).toBe(3000);
    expect(earning?.providerAmount).toBe(3000);
  });

  it('10. Multiple price updates preserve historical earnings integrity', async () => {
    mockEarningsStore.push({
      id: 'earn-1',
      paymentId: 'pay-1',
      providerId: 'prov-A',
      studentId: 'student-1',
      grossAmount: 3000,
      platformFee: 0,
      providerAmount: 3000,
      status: ProviderEarningStatus.PENDING,
    });

    // Provider changes price to ₹3,500 and receives payment 2
    mockProviderA.monthlyPrice = 3500;
    mockEarningsStore.push({
      id: 'earn-2',
      paymentId: 'pay-2',
      providerId: 'prov-A',
      studentId: 'student-2',
      grossAmount: 3500,
      platformFee: 0,
      providerAmount: 3500,
      status: ProviderEarningStatus.PENDING,
    });

    // Provider changes price to ₹4,000 and receives payment 3
    mockProviderA.monthlyPrice = 4000;
    mockEarningsStore.push({
      id: 'earn-3',
      paymentId: 'pay-3',
      providerId: 'prov-A',
      studentId: 'student-1',
      grossAmount: 4000,
      platformFee: 0,
      providerAmount: 4000,
      status: ProviderEarningStatus.PENDING,
    });

    // Provider changes price to ₹5,000
    mockProviderA.monthlyPrice = 5000;

    const summary = await payoutsService.getProviderSummary('user-prov-A');
    expect(summary.totalGross).toBe(10500);
    expect(summary.totalProviderEarnings).toBe(10500);
    expect(summary.pendingAmount).toBe(10500);
  });

  it('11. Provider A cannot access Provider B earnings (isolation)', async () => {
    mockEarningsStore.push({
      id: 'earn-A',
      paymentId: 'pay-A',
      providerId: 'prov-A',
      studentId: 'student-1',
      grossAmount: 3000,
      platformFee: 0,
      providerAmount: 3000,
      status: ProviderEarningStatus.PENDING,
    });

    mockEarningsStore.push({
      id: 'earn-B',
      paymentId: 'pay-B',
      providerId: 'prov-B',
      studentId: 'student-2',
      grossAmount: 2500,
      platformFee: 0,
      providerAmount: 2500,
      status: ProviderEarningStatus.PENDING,
    });

    const summaryA = await payoutsService.getProviderSummary('user-prov-A');
    expect(summaryA.totalProviderEarnings).toBe(3000);

    const summaryB = await payoutsService.getProviderSummary('user-prov-B');
    expect(summaryB.totalProviderEarnings).toBe(2500);

    const historyA = await payoutsService.getProviderHistory('user-prov-A');
    expect(historyA.length).toBe(1);
    expect(historyA[0].providerAmount).toBe(3000);
  });

  it('12. Refund updates earning status to REFUNDED', async () => {
    const payObj: any = {
      id: 'pay-refund-test',
      amount: 3000,
      status: 'paid',
      student: mockStudent1,
      provider: mockProviderA,
    };

    mockPaymentsStore.push(payObj);
    await payoutsService.createEarningForPayment(payObj, 'sub-refund-test');

    const refundRes = await paymentsService.processRefund('pay-refund-test');
    expect(refundRes.status).toBe('refunded');

    const earning = mockEarningsStore.find(
      (e) => e.paymentId === 'pay-refund-test',
    );
    expect(earning?.status).toBe(ProviderEarningStatus.REFUNDED);

    const summary = await payoutsService.getProviderSummary('user-prov-A');
    expect(summary.refundedAmount).toBe(3000);
    expect(summary.pendingAmount).toBe(0);
    expect(summary.totalProviderEarnings).toBe(0);
  });

  it('13. Backfill creates missing records only', async () => {
    mockPaymentsStore.push({
      id: 'pay-old-1',
      amount: 3000,
      status: 'paid',
      student: mockStudent1,
      provider: mockProviderA,
    });

    const result = await payoutsService.backfillExistingPayments();
    expect(result.createdCount).toBe(1);
    expect(mockEarningsStore.length).toBe(1);
  });

  it('14. Backfill can safely run twice without duplicate earnings', async () => {
    mockPaymentsStore.push({
      id: 'pay-old-1',
      amount: 3000,
      status: 'paid',
      student: mockStudent1,
      provider: mockProviderA,
    });

    await payoutsService.backfillExistingPayments();
    const resultSecond = await payoutsService.backfillExistingPayments();

    expect(resultSecond.createdCount).toBe(0);
    expect(mockEarningsStore.length).toBe(1);
  });

  it('15. paidAmount remains zero while external payouts are not implemented', async () => {
    mockEarningsStore.push({
      id: 'earn-1',
      paymentId: 'pay-1',
      providerId: 'prov-A',
      studentId: 'student-1',
      grossAmount: 3000,
      platformFee: 0,
      providerAmount: 3000,
      status: ProviderEarningStatus.PENDING,
    });

    const summary = await payoutsService.getProviderSummary('user-prov-A');
    expect(summary.paidAmount).toBe(0);
    expect(summary.pendingAmount).toBe(3000);
  });
});
