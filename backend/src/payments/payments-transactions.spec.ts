import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { Payment } from './payment.entity';
import { PaymentWebhookEvent } from './webhook-event.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';
import { User } from '../users/user.entity';
import { SupportTicket, SupportTicketStatus, SupportTicketIssueType } from '../support/support-ticket.entity';
import { SupportService } from '../support/support.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

describe('PrimePlate PrimeMate Transactions & Payment Support Center Specification', () => {
  jest.setTimeout(20000);

  let paymentsService: PaymentsService;
  let supportService: SupportService;
  let paymentRepo: any;
  let ticketRepo: any;
  let userRepo: any;
  let planRepo: any;
  let subscriptionsService: any;

  let mockPaymentsStore: any[] = [];
  let mockTicketsStore: any[] = [];
  let mockSubscriptionsStore: any[] = [];

  const mockStudent1: any = {
    id: 'student-uuid-1',
    name: 'Student One',
    email: 'student1@example.com',
    role: 'STUDENT',
  };

  const mockStudent2: any = {
    id: 'student-uuid-2',
    name: 'Student Two',
    email: 'student2@example.com',
    role: 'STUDENT',
  };

  const mockProvider: any = {
    id: 'provider-uuid-1',
    name: 'Royal Hostel Mess',
    city: 'Hyderabad',
    address: 'Hitech City Road',
  };

  const mockMealPlan: any = {
    id: 'plan-uuid-1',
    title: 'Deluxe Monthly Plan',
    pricePerMonth: 4500,
    durationDays: 30,
    provider: mockProvider,
  };

  beforeEach(async () => {
    mockPaymentsStore = [
      {
        id: 'payment-1',
        amount: 4500,
        razorpayOrderId: 'order_paid_student1',
        razorpayPaymentId: 'pay_paid_student1',
        status: 'paid',
        durationDays: 30,
        mealPlanId: 'plan-uuid-1',
        student: mockStudent1,
        provider: mockProvider,
        createdAt: new Date('2026-09-01T10:00:00Z'),
      },
      {
        id: 'payment-2',
        amount: 4500,
        razorpayOrderId: 'order_pending_student1',
        razorpayPaymentId: null,
        status: 'created',
        durationDays: 30,
        mealPlanId: 'plan-uuid-1',
        student: mockStudent1,
        provider: mockProvider,
        createdAt: new Date('2026-09-02T10:00:00Z'),
      },
      {
        id: 'payment-3',
        amount: 4500,
        razorpayOrderId: 'order_failed_student1',
        razorpayPaymentId: null,
        status: 'failed',
        durationDays: 30,
        mealPlanId: 'plan-uuid-1',
        student: mockStudent1,
        provider: mockProvider,
        createdAt: new Date('2026-09-02T11:00:00Z'),
      },
      {
        id: 'payment-4',
        amount: 4500,
        razorpayOrderId: 'order_refunded_student1',
        razorpayPaymentId: 'pay_refunded_1',
        status: 'refunded',
        durationDays: 30,
        mealPlanId: 'plan-uuid-1',
        student: mockStudent1,
        provider: mockProvider,
        createdAt: new Date('2026-08-15T10:00:00Z'),
      },
      {
        id: 'payment-student2',
        amount: 4500,
        razorpayOrderId: 'order_paid_student2',
        razorpayPaymentId: 'pay_paid_student2',
        status: 'paid',
        durationDays: 30,
        mealPlanId: 'plan-uuid-1',
        student: mockStudent2,
        provider: mockProvider,
        createdAt: new Date('2026-09-01T12:00:00Z'),
      },
    ];

    mockTicketsStore = [];
    mockSubscriptionsStore = [
      {
        id: 'sub-uuid-1',
        student: mockStudent1,
        provider: mockProvider,
        mealPlan: mockMealPlan,
        razorpayOrderId: 'order_paid_student1',
        status: 'ACTIVE',
        startDate: new Date('2026-09-01T10:00:00Z'),
        endDate: new Date('2026-10-01T10:00:00Z'),
      },
    ];

    paymentRepo = {
      find: jest.fn().mockImplementation((opts) => {
        const studentId = opts?.where?.student?.id;
        return mockPaymentsStore.filter((p) => p.student?.id === studentId);
      }),
      findOne: jest.fn().mockImplementation((opts) => {
        const orderId = opts?.where?.razorpayOrderId;
        const id = opts?.where?.id;
        return mockPaymentsStore.find((p) => p.razorpayOrderId === orderId || p.id === id) || null;
      }),
      save: jest.fn().mockImplementation((p) => {
        const idx = mockPaymentsStore.findIndex((x) => x.id === p.id);
        if (idx >= 0) mockPaymentsStore[idx] = p;
        else mockPaymentsStore.push(p);
        return p;
      }),
    };

    ticketRepo = {
      find: jest.fn().mockImplementation((opts) => {
        const studentId = opts?.where?.student?.id;
        return mockTicketsStore.filter((t) => t.student?.id === studentId);
      }),
      findOne: jest.fn().mockImplementation((opts) => {
        if (opts?.where?.id) {
          return mockTicketsStore.find((t) => t.id === opts.where.id) || null;
        }
        if (opts?.where?.student?.id && opts?.where?.razorpayOrderId) {
          return (
            mockTicketsStore.find(
              (t) =>
                t.student?.id === opts.where.student.id &&
                t.razorpayOrderId === opts.where.razorpayOrderId,
            ) || null
          );
        }
        return null;
      }),
      create: jest.fn().mockImplementation((dto) => ({
        id: `ticket-uuid-${Date.now()}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...dto,
      })),
      save: jest.fn().mockImplementation((t) => {
        mockTicketsStore.push(t);
        return t;
      }),
    };

    userRepo = {
      findOne: jest.fn().mockImplementation((opts) => {
        if (opts?.where?.id === mockStudent1.id) return mockStudent1;
        if (opts?.where?.id === mockStudent2.id) return mockStudent2;
        return null;
      }),
    };

    planRepo = {
      find: jest.fn().mockReturnValue([mockMealPlan]),
      findOne: jest.fn().mockReturnValue(mockMealPlan),
    };

    subscriptionsService = {
      findByStudent: jest.fn().mockImplementation((userId) => {
        return mockSubscriptionsStore.filter((s) => s.student?.id === userId);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        SupportService,
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('mock_secret') } },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(PaymentWebhookEvent), useValue: {} },
        { provide: getRepositoryToken(MealPlan), useValue: planRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(SupportTicket), useValue: ticketRepo },
        { provide: SubscriptionsService, useValue: subscriptionsService },
      ],
    }).compile();

    paymentsService = module.get<PaymentsService>(PaymentsService);
    supportService = module.get<SupportService>(SupportService);
  });

  describe('1 & 2. Student Payment History & Student Isolation', () => {
    it('should return only payments belonging to the authenticated student', async () => {
      const history = await paymentsService.getHistory(mockStudent1.id);
      expect(history.length).toBe(4);
      expect(history.every((p) => p.razorpayOrderId !== 'order_paid_student2')).toBe(true);
    });

    it('should return empty list for student with zero payments without throwing errors', async () => {
      const history = await paymentsService.getHistory('non-existent-student');
      expect(history).toEqual([]);
    });
  });

  describe('3. Payment Details Ownership & IDOR Protection', () => {
    it('should allow student to view their own payment order details', async () => {
      const details = await paymentsService.getPaymentDetails('order_paid_student1', mockStudent1.id);
      expect(details.payment.amount).toBe(4500);
      expect(details.payment.status).toBe('SUCCESS');
      expect(details.subscription?.status).toBe('ACTIVE');
      const messCardEvent = details.timeline.find((t: any) => t.event === 'MESSCARD_ACTIVATED');
      expect(messCardEvent).toBeDefined();
      expect(messCardEvent.timestamp).toEqual(mockPaymentsStore[0].createdAt);
    });

    it('should throw ForbiddenException when Student 1 attempts to view Student 2 order details (IDOR Prevention)', async () => {
      await expect(
        paymentsService.getPaymentDetails('order_paid_student2', mockStudent1.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4, 5, 6 & 7. Status Mapping & Refund Handling', () => {
    it('should map paid payment status to SUCCESS', async () => {
      const history = await paymentsService.getHistory(mockStudent1.id);
      const paid = history.find((p) => p.razorpayOrderId === 'order_paid_student1');
      expect(paid.status).toBe('SUCCESS');
    });

    it('should map created/processing payment status to PENDING', async () => {
      const history = await paymentsService.getHistory(mockStudent1.id);
      const pending = history.find((p) => p.razorpayOrderId === 'order_pending_student1');
      expect(pending.status).toBe('PENDING');
    });

    it('should map failed payment status to FAILED', async () => {
      const history = await paymentsService.getHistory(mockStudent1.id);
      const failed = history.find((p) => p.razorpayOrderId === 'order_failed_student1');
      expect(failed.status).toBe('FAILED');
    });

    it('should map refunded payment status to REFUNDED', async () => {
      const history = await paymentsService.getHistory(mockStudent1.id);
      const refunded = history.find((p) => p.razorpayOrderId === 'order_refunded_student1');
      expect(refunded.status).toBe('REFUNDED');
    });
  });

  describe('8, 9, 10 & 16. Payment Status Verification & Recovery', () => {
    it('should enforce IDOR check on getPaymentStatus', async () => {
      await expect(
        paymentsService.getPaymentStatus('order_paid_student2', mockStudent1.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should return SUCCESS status for existing paid payment', async () => {
      const res = await paymentsService.getPaymentStatus('order_paid_student1', mockStudent1.id);
      expect(res.status).toBe('SUCCESS');
      expect(res.paymentStatus).toBe('PAID');
    });

    it('should return FAILED status for failed order', async () => {
      const res = await paymentsService.getPaymentStatus('order_failed_student1', mockStudent1.id);
      expect(res.status).toBe('FAILED');
    });

    it('should return PROCESSING status for pending order when Razorpay API is not configured', async () => {
      const res = await paymentsService.getPaymentStatus('order_pending_student1', mockStudent1.id);
      expect(res.status).toBe('PROCESSING');
    });
  });

  describe('11, 12, 13, 14 & 15. Support Ticket Creation, IDOR & Duplicate Protection', () => {
    it('should create a support ticket with server-generated ticket number', async () => {
      const ticket = await supportService.createPaymentIssueTicket(mockStudent1.id, {
        razorpayOrderId: 'order_failed_student1',
        issueType: SupportTicketIssueType.MONEY_DEBITED_PAYMENT_FAILED,
        description: 'Money debited from UPI account but status is failed',
        utrReference: 'UTR12345678',
      });

      expect(ticket.ticketNumber).toMatch(/^TK-\d{8}-\d{4}$/);
      expect(ticket.status).toBe(SupportTicketStatus.OPEN);
      expect(ticket.razorpayOrderId).toBe('order_failed_student1');
    });

    it('should throw ForbiddenException if Student 1 attempts to raise ticket for Student 2 order (IDOR)', async () => {
      await expect(
        supportService.createPaymentIssueTicket(mockStudent1.id, {
          razorpayOrderId: 'order_paid_student2',
          issueType: SupportTicketIssueType.OTHER,
          description: 'Attempting IDOR ticket creation',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if order ID does not exist', async () => {
      await expect(
        supportService.createPaymentIssueTicket(mockStudent1.id, {
          razorpayOrderId: 'invalid_order_xyz',
          issueType: SupportTicketIssueType.OTHER,
          description: 'Testing non-existent order ID',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when raising duplicate ticket for same order', async () => {
      await supportService.createPaymentIssueTicket(mockStudent1.id, {
        razorpayOrderId: 'order_failed_student1',
        issueType: SupportTicketIssueType.MONEY_DEBITED_PAYMENT_FAILED,
        description: 'First ticket creation',
      });

      await expect(
        supportService.createPaymentIssueTicket(mockStudent1.id, {
          razorpayOrderId: 'order_failed_student1',
          issueType: SupportTicketIssueType.MONEY_DEBITED_PAYMENT_FAILED,
          description: 'Duplicate ticket attempt',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if UTR format is invalid', async () => {
      await expect(
        supportService.createPaymentIssueTicket(mockStudent1.id, {
          razorpayOrderId: 'order_failed_student1',
          issueType: SupportTicketIssueType.MONEY_DEBITED_PAYMENT_FAILED,
          description: 'Invalid UTR test',
          utrReference: '12', // Too short (<4 chars)
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('17 & 18. Browser-Close Recovery & Non-Duplication', () => {
    it('should return SUCCESS and active subscription for student returning after browser close', async () => {
      const details = await paymentsService.getPaymentDetails('order_paid_student1', mockStudent1.id);
      expect(details.payment.status).toBe('SUCCESS');
      expect(details.subscription?.status).toBe('ACTIVE');
      expect(details.subscription?.messCardAvailable).toBe(true);
    });

    it('should not return duplicate payment records in history', async () => {
      const history = await paymentsService.getHistory(mockStudent1.id);
      const orderIds = history.map((p) => p.razorpayOrderId);
      const uniqueOrderIds = new Set(orderIds);
      expect(orderIds.length).toBe(uniqueOrderIds.size);
    });
  });
});
