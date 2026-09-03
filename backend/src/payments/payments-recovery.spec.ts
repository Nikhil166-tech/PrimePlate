import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PaymentsService } from './payments.service';
import { Payment } from './payment.entity';
import { PaymentWebhookEvent } from './webhook-event.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';
import { User } from '../users/user.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/subscription.entity';
import {
  ProviderEarning,
  ProviderEarningStatus,
} from '../payouts/provider-earning.entity';
import { SupportTicket } from '../support/support-ticket.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

describe('PrimePlate Payment Security & Recovery Specification', () => {
  jest.setTimeout(20000);

  let paymentsService: PaymentsService;
  let paymentRepo: any;
  let webhookEventRepo: any;
  let userRepo: any;
  let planRepo: any;
  let subscriptionsService: any;

  const keySecret = 'test_key_secret_12345';
  const webhookSecret = 'test_webhook_secret_67890';

  let mockPaymentsStore: any[] = [];
  let mockWebhookEventsStore: any[] = [];
  let mockSubscriptionsStore: any[] = [];
  let mockEarningsStore: any[] = [];

  const mockStudent1: any = {
    id: 'student-uuid-1',
    name: 'PrimeMate User 1',
    email: 'student1@example.com',
    role: 'STUDENT',
  };

  const mockStudent2: any = {
    id: 'student-uuid-2',
    name: 'PrimeMate User 2',
    email: 'student2@example.com',
    role: 'STUDENT',
  };

  const mockProvider: any = {
    id: 'provider-uuid-1',
    name: 'South Indian Mess',
    monthlyPrice: 3000,
    approvalStatus: 'APPROVED',
    acceptingSubscriptions: true,
    totalCapacity: 100,
  };

  const mockMealPlan: any = {
    id: 'plan-uuid-1',
    title: 'Standard Meal Plan',
    pricePerMonth: 3000,
    provider: mockProvider,
  };

  beforeEach(async () => {
    mockPaymentsStore = [];
    mockWebhookEventsStore = [];
    mockSubscriptionsStore = [];
    mockEarningsStore = [];

    const mockManager: any = {
      connection: { options: { type: 'better-sqlite3' } },
      findOne: jest.fn().mockImplementation((entity, opts) => {
        if (entity === User) {
          if (opts?.where?.id === mockStudent1.id) return mockStudent1;
          if (opts?.where?.id === mockStudent2.id) return mockStudent2;
        }
        if (entity === MealPlan) return mockMealPlan;
        if (entity === MealProvider) return mockProvider;
        if (entity === Payment) {
          return (
            mockPaymentsStore.find((p) => {
              if (Array.isArray(opts?.where)) {
                return opts.where.some(
                  (w: any) =>
                    (w.razorpayOrderId &&
                      w.razorpayOrderId === p.razorpayOrderId) ||
                    (w.razorpayPaymentId &&
                      w.razorpayPaymentId === p.razorpayPaymentId),
                );
              }
              return opts?.where?.id === p.id;
            }) || null
          );
        }
        return null;
      }),
      count: jest.fn().mockImplementation((entity, opts) => {
        if (entity === Subscription) {
          return mockSubscriptionsStore.filter(
            (s) => s.status === SubscriptionStatus.ACTIVE,
          ).length;
        }
        return 0;
      }),
      create: jest.fn().mockImplementation((entity, data) => ({
        ...data,
        id: `gen_${Date.now()}_${Math.random()}`,
      })),
      save: jest.fn().mockImplementation((entity, data) => {
        if (entity === Payment || data.razorpayOrderId) {
          const idx = mockPaymentsStore.findIndex(
            (p) => p.razorpayOrderId === data.razorpayOrderId,
          );
          if (idx >= 0) {
            mockPaymentsStore[idx] = { ...mockPaymentsStore[idx], ...data };
            return mockPaymentsStore[idx];
          }
          mockPaymentsStore.push(data);
          return data;
        }
        if (entity === Subscription || data.student) {
          mockSubscriptionsStore.push(data);
          return data;
        }
        if (entity === ProviderEarning || data.providerId) {
          mockEarningsStore.push(data);
          return data;
        }
        return data;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'RAZORPAY_KEY_ID') return 'rzp_test_key_123';
              if (key === 'RAZORPAY_KEY_SECRET') return keySecret;
              if (key === 'RAZORPAY_WEBHOOK_SECRET') return webhookSecret;
              return null;
            }),
          },
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            create: jest
              .fn()
              .mockImplementation((d) => ({ ...d, id: `pay_${Date.now()}` })),
            save: jest.fn().mockImplementation((d) => {
              const idx = mockPaymentsStore.findIndex(
                (p) => p.razorpayOrderId === d.razorpayOrderId,
              );
              if (idx >= 0) {
                mockPaymentsStore[idx] = { ...mockPaymentsStore[idx], ...d };
                return mockPaymentsStore[idx];
              }
              mockPaymentsStore.push(d);
              return d;
            }),
            findOne: jest.fn().mockImplementation((opts) => {
              if (Array.isArray(opts?.where)) {
                return (
                  mockPaymentsStore.find((p) =>
                    opts.where.some(
                      (w: any) =>
                        (w.razorpayOrderId &&
                          w.razorpayOrderId === p.razorpayOrderId) ||
                        (w.razorpayPaymentId &&
                          w.razorpayPaymentId === p.razorpayPaymentId),
                    ),
                  ) || null
                );
              }
              return (
                mockPaymentsStore.find(
                  (p) =>
                    p.razorpayOrderId === opts?.where?.razorpayOrderId ||
                    p.id === opts?.where?.id,
                ) || null
              );
            }),
            find: jest.fn().mockImplementation((opts) => {
              if (opts?.where?.student?.id) {
                return mockPaymentsStore.filter(
                  (p) => p.student?.id === opts.where.student.id,
                );
              }
              return [...mockPaymentsStore];
            }),
            manager: {
              transaction: jest
                .fn()
                .mockImplementation((cb) => cb(mockManager)),
            },
          },
        },
        {
          provide: getRepositoryToken(PaymentWebhookEvent),
          useValue: {
            create: jest
              .fn()
              .mockImplementation((d) => ({ ...d, id: `we_${Date.now()}` })),
            save: jest.fn().mockImplementation((d) => {
              const existing = mockWebhookEventsStore.find(
                (e) => e.eventId === d.eventId,
              );
              if (existing) {
                const err: any = new Error(
                  'UNIQUE constraint failed: payment_webhook_events.eventId',
                );
                err.code = '23505';
                throw err;
              }
              mockWebhookEventsStore.push(d);
              return d;
            }),
          },
        },
        {
          provide: getRepositoryToken(MealPlan),
          useValue: {
            findOne: jest.fn().mockResolvedValue(mockMealPlan),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn().mockImplementation((opts) => {
              if (opts?.where?.id === mockStudent1.id) return mockStudent1;
              if (opts?.where?.id === mockStudent2.id) return mockStudent2;
              return null;
            }),
          },
        },
        {
          provide: getRepositoryToken(SupportTicket),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: SubscriptionsService,
          useValue: {
            findByStudent: jest.fn().mockImplementation((uid: string) => {
              return mockSubscriptionsStore
                .filter((s) => s.student?.id === uid)
                .map((s) => ({ ...s, mealPlan: mockMealPlan }));
            }),
          },
        },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    webhookEventRepo = module.get(getRepositoryToken(PaymentWebhookEvent));
    userRepo = module.get(getRepositoryToken(User));
    planRepo = module.get(getRepositoryToken(MealPlan));
    subscriptionsService =
      module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('0. Order Creation Pre-Persistence (createOrder)', () => {
    it('pre-persists pending local payment record with status created during createOrder', async () => {
      const order = await paymentsService.createOrder(
        mockMealPlan.id,
        mockStudent1.id,
        30,
      );

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();

      const savedPayment = mockPaymentsStore.find(
        (p) => p.razorpayOrderId === order.id,
      );
      expect(savedPayment).toBeDefined();
      expect(savedPayment.status).toBe('created');
      expect(savedPayment.durationDays).toBe(30);
      expect(savedPayment.mealPlanId).toBe(mockMealPlan.id);
    });
  });

  describe('1. Webhook Signature Validation (Raw Body HMAC-SHA256)', () => {
    it('successfully validates exact raw request body against RAZORPAY_WEBHOOK_SECRET', () => {
      const rawPayload = JSON.stringify({
        entity: 'event',
        event: 'payment.captured',
        payload: {
          payment: { entity: { id: 'pay_raw_123', order_id: 'order_raw_123' } },
        },
      });

      const validSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawPayload)
        .digest('hex');

      const result = paymentsService.verifyWebhookSignature(
        rawPayload,
        validSig,
      );
      expect(result).toBe(true);
    });

    it('rejects an invalid webhook signature using timing-safe comparison', () => {
      const rawPayload = '{"event":"payment.captured"}';
      const fakeSig =
        'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

      const result = paymentsService.verifyWebhookSignature(
        rawPayload,
        fakeSig,
      );
      expect(result).toBe(false);
    });

    it('throws BadRequestException on invalid webhook signature in handleWebhook', async () => {
      await expect(
        paymentsService.handleWebhook('{"fake":"body"}', 'invalid_sig', {
          event: 'payment.captured',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException in handleWebhook if order metadata is missing and unresolvable', async () => {
      const rawBody = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_no_meta',
              order_id: 'order_no_meta',
            },
          },
        },
      });

      const sig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      await expect(
        paymentsService.handleWebhook(rawBody, sig, JSON.parse(rawBody)),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. Webhook Event Idempotency (x-razorpay-event-id)', () => {
    it('processes first webhook event and safely ignores duplicate replay', async () => {
      const rawBody = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_evt_1',
              order_id: 'order_evt_1',
              notes: {
                userId: mockStudent1.id,
                mealPlanId: mockMealPlan.id,
                durationDays: 30,
              },
            },
          },
        },
      });

      const sig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      const eventData = JSON.parse(rawBody);
      const headers = { 'x-razorpay-event-id': 'evt_unique_12345' };

      // First delivery
      const res1 = await paymentsService.handleWebhook(
        rawBody,
        sig,
        eventData,
        headers,
      );
      expect(res1).toEqual({ status: 'OK' });
      expect(mockSubscriptionsStore.length).toBe(1);
      expect(mockPaymentsStore.length).toBe(1);

      // Second duplicate delivery
      const res2 = await paymentsService.handleWebhook(
        rawBody,
        sig,
        eventData,
        headers,
      );
      expect(res2).toEqual({
        status: 'OK',
        message: 'Event already processed',
      });
      expect(mockSubscriptionsStore.length).toBe(1);
      expect(mockPaymentsStore.length).toBe(1);
    });
  });

  describe('3. Webhook Duration Preservation (1, 7, 15, 30 Days)', () => {
    it.each([1, 7, 15, 30])(
      'preserves %i-day duration during webhook recovery',
      async (durationDays) => {
        const orderId = `order_dur_${durationDays}`;
        const paymentId = `pay_dur_${durationDays}`;

        // Pre-persist order with duration
        mockPaymentsStore.push({
          id: `p_${orderId}`,
          student: mockStudent1,
          provider: mockProvider,
          amount: Math.round((3000 / 30) * durationDays),
          razorpayOrderId: orderId,
          status: 'created',
          durationDays,
          mealPlanId: mockMealPlan.id,
        });

        const rawBody = JSON.stringify({
          event: 'payment.captured',
          payload: {
            payment: {
              entity: {
                id: paymentId,
                order_id: orderId,
                notes: {
                  userId: mockStudent1.id,
                  mealPlanId: mockMealPlan.id,
                  durationDays,
                },
              },
            },
          },
        });

        const sig = crypto
          .createHmac('sha256', webhookSecret)
          .update(rawBody)
          .digest('hex');
        const eventData = JSON.parse(rawBody);

        await paymentsService.handleWebhook(rawBody, sig, eventData);

        const createdSub = mockSubscriptionsStore.find(
          (s) =>
            s.student?.id === mockStudent1.id &&
            s.mealPlan?.id === mockMealPlan.id,
        );
        expect(createdSub).toBeDefined();

        const start = new Date(createdSub.startDate);
        const end = new Date(createdSub.endDate);
        const diffDays = Math.round(
          (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
        );
        expect(diffDays).toBe(durationDays);
      },
    );
  });

  describe('4. Payment Status Recovery Endpoint (getPaymentStatus)', () => {
    it('returns SUCCESS with subscription details for paid orders', async () => {
      const orderId = 'order_status_success';
      mockPaymentsStore.push({
        id: 'p_status_1',
        student: mockStudent1,
        provider: mockProvider,
        amount: 3000,
        razorpayOrderId: orderId,
        razorpayPaymentId: 'pay_status_1',
        status: 'paid',
        durationDays: 30,
        mealPlanId: mockMealPlan.id,
      });

      const res = await paymentsService.getPaymentStatus(
        orderId,
        mockStudent1.id,
      );
      expect(res.status).toBe('SUCCESS');
      expect(res.paymentStatus).toBe('PAID');
      expect(res.amount).toBe(3000);
    });

    it('returns FAILED for failed payment orders', async () => {
      const orderId = 'order_status_failed';
      mockPaymentsStore.push({
        id: 'p_status_2',
        student: mockStudent1,
        provider: mockProvider,
        amount: 3000,
        razorpayOrderId: orderId,
        status: 'failed',
      });

      const res = await paymentsService.getPaymentStatus(
        orderId,
        mockStudent1.id,
      );
      expect(res.status).toBe('FAILED');
      expect(res.paymentStatus).toBe('FAILED');
    });

    it('enforces ownership: throws ForbiddenException if user checks another user order', async () => {
      const orderId = 'order_belonging_to_student1';
      mockPaymentsStore.push({
        id: 'p_status_3',
        student: mockStudent1,
        provider: mockProvider,
        amount: 3000,
        razorpayOrderId: orderId,
        status: 'created',
      });

      await expect(
        paymentsService.getPaymentStatus(orderId, mockStudent2.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Order-User Verification Ownership Protection', () => {
    it('throws ForbiddenException if a student attempts to verify an order created by someone else', async () => {
      const orderId = 'order_created_by_student1';
      mockPaymentsStore.push({
        id: 'p_owner_1',
        student: mockStudent1,
        provider: mockProvider,
        amount: 3000,
        razorpayOrderId: orderId,
        status: 'created',
        durationDays: 30,
        mealPlanId: mockMealPlan.id,
      });

      await expect(
        paymentsService.processVerifiedPayment({
          userId: mockStudent2.id,
          razorpayOrderId: orderId,
          razorpayPaymentId: 'pay_owner_1',
          razorpaySignature: 'sig_test_123',
          mealPlanId: mockMealPlan.id,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('6. Webhook Failed Payment Event', () => {
    it('updates payment status to failed and does not activate subscription', async () => {
      const orderId = 'order_failed_event';
      mockPaymentsStore.push({
        id: 'p_fail_1',
        student: mockStudent1,
        provider: mockProvider,
        amount: 3000,
        razorpayOrderId: orderId,
        status: 'created',
      });

      const rawBody = JSON.stringify({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_failed_123',
              order_id: orderId,
            },
          },
        },
      });

      const sig = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');
      const eventData = JSON.parse(rawBody);

      await paymentsService.handleWebhook(rawBody, sig, eventData);

      const updated = mockPaymentsStore.find(
        (p) => p.razorpayOrderId === orderId,
      );
      expect(updated.status).toBe('failed');
      expect(mockSubscriptionsStore.length).toBe(0);
      expect(mockEarningsStore.length).toBe(0);
    });
  });

  describe('7. Payment Amount Integrity Validation', () => {
    it('rejects recovery when payment amount does not match authoritative order amount', async () => {
      const orderId = 'order_mismatch_1';
      mockPaymentsStore.push({
        id: 'p_mismatch_1',
        student: mockStudent1,
        provider: mockProvider,
        amount: 3000,
        razorpayOrderId: orderId,
        status: 'created',
        durationDays: 30,
        mealPlanId: mockMealPlan.id,
      });

      await expect(
        paymentsService.reconcileCapturedPayment({
          userId: mockStudent1.id,
          razorpayOrderId: orderId,
          razorpayPaymentId: 'pay_mismatch_1',
          mealPlanId: mockMealPlan.id,
          durationInput: 30,
          skipSignatureCheck: true,
          paymentAmountInPaise: 150000, // ₹1,500 instead of ₹3,000
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('8. Failed Attempt Followed by Successful Captured Attempt', () => {
    it('reconciles captured attempt even after an earlier failed attempt record', async () => {
      const orderId = 'order_retry_success';
      mockPaymentsStore.push({
        id: 'p_retry_1',
        student: mockStudent1,
        provider: mockProvider,
        amount: 3000,
        razorpayOrderId: orderId,
        status: 'failed',
        durationDays: 30,
        mealPlanId: mockMealPlan.id,
      });

      const res = await paymentsService.reconcileCapturedPayment({
        userId: mockStudent1.id,
        razorpayOrderId: orderId,
        razorpayPaymentId: 'pay_captured_retry',
        mealPlanId: mockMealPlan.id,
        durationInput: 30,
        skipSignatureCheck: true,
        paymentAmountInPaise: 300000,
      });

      expect(res.success).toBe(true);
      expect(res.payment.status).toBe('paid');
      expect(mockSubscriptionsStore.length).toBe(1);
      expect(mockEarningsStore.length).toBe(1);
    });
  });
});

