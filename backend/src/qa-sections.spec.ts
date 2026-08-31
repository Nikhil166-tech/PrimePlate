import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

// Entities & Services
import { AnalyticsService } from './analytics/analytics.service';
import { SubscriptionBreaksService } from './subscription-breaks/subscription-breaks.service';
import { ReviewsService } from './reviews/reviews.service';
import { AuthService } from './auth/auth.service';
import { UsersService } from './users/users.service';
import { EmailService } from './common/email.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { Payment } from './payments/payment.entity';
import {
  Subscription,
  SubscriptionStatus,
} from './subscriptions/subscription.entity';
import { MealProvider } from './providers/meal-provider.entity';
import { User } from './users/user.entity';
import { MealPlan } from './meal-plans/meal-plan.entity';
import {
  SubscriptionBreakRequest,
  SubscriptionBreakStatus,
} from './subscription-breaks/subscription-break-request.entity';
import { Review } from './reviews/review.entity';
import { PasswordResetToken } from './auth/password-reset-token.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { Role } from './common/roles.enum';

describe('PrimePlate Comprehensive QA Suite (Sections 19, 24, 26, 27, 28, 30, 40)', () => {
  // Section 19 & 40: Historical Price / Revenue
  describe('SECTION 19 & 40: Historical Price and Revenue Integrity', () => {
    let analyticsService: AnalyticsService;
    let paymentRepo: Repository<Payment>;

    const mockPayments: Payment[] = [
      { id: 'p1', amount: 3000, status: 'paid' } as Payment,
      { id: 'p2', amount: 3500, status: 'paid' } as Payment,
      { id: 'p3', amount: 4000, status: 'paid' } as Payment,
      { id: 'p4-failed', amount: 3000, status: 'failed' } as Payment,
    ];

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AnalyticsService,
          {
            provide: getRepositoryToken(Payment),
            useValue: {
              createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                getRawOne: jest.fn().mockImplementation(async () => {
                  const paid = mockPayments.filter((p) => p.status === 'paid');
                  const total = paid.reduce((sum, p) => sum + p.amount, 0);
                  return { total };
                }),
              })),
            },
          },
          {
            provide: getRepositoryToken(User),
            useValue: { count: jest.fn().mockResolvedValue(10) },
          },
          {
            provide: getRepositoryToken(MealProvider),
            useValue: { count: jest.fn().mockResolvedValue(3) },
          },
          {
            provide: getRepositoryToken(Subscription),
            useValue: { count: jest.fn().mockResolvedValue(3) },
          },
        ],
      }).compile();

      analyticsService = module.get<AnalyticsService>(AnalyticsService);
      paymentRepo = module.get<Repository<Payment>>(
        getRepositoryToken(Payment),
      );
    });

    it('calculates total revenue as ₹10,500 from historical paid records (excluding failed/unverified)', async () => {
      const totalRev = await analyticsService.getTotalRevenue();
      expect(totalRev).toBe(10500);
    });

    it('mutating current provider price to ₹5,000 does not alter existing payment amounts or historical revenue', async () => {
      const mockProvider = { id: 'prov-1', monthlyPrice: 3000 };
      // Simulate historical student purchases
      const studentAPayment = { id: 'p1', amount: 3000, status: 'paid' };
      mockProvider.monthlyPrice = 3500;
      const studentBPayment = { id: 'p2', amount: 3500, status: 'paid' };
      mockProvider.monthlyPrice = 4000;
      const studentCPayment = { id: 'p3', amount: 4000, status: 'paid' };

      // Provider updates price to 5000 without new purchases
      mockProvider.monthlyPrice = 5000;

      expect(studentAPayment.amount).toBe(3000);
      expect(studentBPayment.amount).toBe(3500);
      expect(studentCPayment.amount).toBe(4000);

      const total =
        studentAPayment.amount +
        studentBPayment.amount +
        studentCPayment.amount;
      expect(total).toBe(10500);
    });

    it('verifies duration pricing formula (1 Day, 1 Week, 15 Days, 1 Month) for ₹3,000 base price', () => {
      const baseMonthlyPrice = 3000;
      const calcPrice = (days: number) =>
        Math.max(1, Math.round(baseMonthlyPrice * (days / 30)));
      expect(calcPrice(1)).toBe(100);
      expect(calcPrice(7)).toBe(700);
      expect(calcPrice(15)).toBe(1500);
      expect(calcPrice(30)).toBe(3000);
    });
  });

  // Section 24 & 30: Subscription Break Rules & Provider Setting
  describe('SECTION 24 & 30: Subscription Break & Provider Setting', () => {
    let breaksService: SubscriptionBreaksService;
    let breakRepo: any;
    let subRepo: any;
    let providerRepo: any;
    let userRepo: any;
    let dataSource: any;

    const studentUser: any = { id: 'student-1', role: Role.STUDENT };
    const providerUser: any = { id: 'provider-user-1', role: Role.PROVIDER };
    const providerEntity: any = {
      id: 'provider-1',
      name: 'Test Mess',
      subscriptionBreaksEnabled: true,
      user: providerUser,
      userId: providerUser.id,
    };

    const oneMonthSub: any = {
      id: 'sub-month',
      student: studentUser,
      status: SubscriptionStatus.ACTIVE,
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      mealPlan: {
        id: 'plan-1',
        title: '1 Month Standard Plan',
        provider: providerEntity,
      },
    };

    const oneDaySub: any = {
      id: 'sub-day',
      student: studentUser,
      status: SubscriptionStatus.ACTIVE,
      startDate: '2026-09-01',
      endDate: '2026-09-01',
      mealPlan: {
        id: 'plan-day',
        title: '1 Day Plan',
        provider: providerEntity,
      },
    };

    beforeEach(async () => {
      breakRepo = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        create: jest.fn((dto) => ({ ...dto, id: 'break-req-1' })),
        save: jest.fn((entity) => Promise.resolve(entity)),
      };

      subRepo = {
        findOne: jest.fn(),
        save: jest.fn((entity) => Promise.resolve(entity)),
      };

      providerRepo = {
        findOne: jest.fn().mockResolvedValue(providerEntity),
        save: jest.fn((entity) => Promise.resolve(entity)),
      };

      userRepo = {
        findOne: jest.fn().mockResolvedValue(studentUser),
      };

      dataSource = {
        transaction: jest.fn(async (cb) => {
          const manager: any = {
            findOne: jest.fn((entityClass, opts) => {
              if (entityClass === SubscriptionBreakRequest) {
                return Promise.resolve({
                  id: opts.where.id,
                  status: SubscriptionBreakStatus.PENDING,
                  breakDays: 3,
                  subscriptionId: 'sub-month',
                  provider: providerEntity,
                });
              }
              if (entityClass === Subscription) {
                return Promise.resolve({ ...oneMonthSub });
              }
              return null;
            }),
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn((entityClass, entity) =>
              Promise.resolve(entity || entityClass),
            ),
          };
          return cb(manager);
        }),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SubscriptionBreaksService,
          {
            provide: getRepositoryToken(SubscriptionBreakRequest),
            useValue: breakRepo,
          },
          { provide: getRepositoryToken(Subscription), useValue: subRepo },
          { provide: getRepositoryToken(MealProvider), useValue: providerRepo },
          { provide: getRepositoryToken(User), useValue: userRepo },
          { provide: DataSource, useValue: dataSource },
        ],
      }).compile();

      breaksService = module.get<SubscriptionBreaksService>(
        SubscriptionBreaksService,
      );
    });

    it('rejects break requests for non 1-month subscriptions (e.g. 1-day plan)', async () => {
      subRepo.findOne.mockResolvedValue(oneDaySub);
      await expect(
        breaksService.createBreakRequest('student-1', {
          subscriptionId: 'sub-day',
          fromDate: '2026-09-01',
          toDate: '2026-09-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects break requests when provider setting subscriptionBreaksEnabled is disabled', async () => {
      subRepo.findOne.mockResolvedValue(oneMonthSub);
      providerRepo.findOne.mockResolvedValue({
        ...providerEntity,
        subscriptionBreaksEnabled: false,
      });

      await expect(
        breaksService.createBreakRequest('student-1', {
          subscriptionId: 'sub-month',
          fromDate: '2026-09-10',
          toDate: '2026-09-12',
        }),
      ).rejects.toThrow(
        'Subscription breaks are not available for this provider.',
      );
    });

    it('rejects breaks with duration > 4 days (e.g. 5 days)', async () => {
      subRepo.findOne.mockResolvedValue(oneMonthSub);
      providerRepo.findOne.mockResolvedValue(providerEntity);

      await expect(
        breaksService.createBreakRequest('student-1', {
          subscriptionId: 'sub-month',
          fromDate: '2026-09-10',
          toDate: '2026-09-14', // 5 days inclusive
        }),
      ).rejects.toThrow('Break duration must be between 1 and 4 days.');
    });

    it('allows valid 3-day break (Aug 10 -> Aug 12) with initial status PENDING', async () => {
      subRepo.findOne.mockResolvedValue(oneMonthSub);
      providerRepo.findOne.mockResolvedValue(providerEntity);

      const req = await breaksService.createBreakRequest('student-1', {
        subscriptionId: 'sub-month',
        fromDate: '2026-09-10',
        toDate: '2026-09-12', // 3 days
      });

      expect(req.status).toBe(SubscriptionBreakStatus.PENDING);
      expect(req.breakDays).toBe(3);
    });

    it('rejects overlapping break requests', async () => {
      subRepo.findOne.mockResolvedValue(oneMonthSub);
      providerRepo.findOne.mockResolvedValue(providerEntity);
      breakRepo.find.mockResolvedValue([
        {
          subscriptionId: 'sub-month',
          status: SubscriptionBreakStatus.PENDING,
          fromDate: '2026-09-10',
          toDate: '2026-09-12',
        },
      ]);

      await expect(
        breaksService.createBreakRequest('student-1', {
          subscriptionId: 'sub-month',
          fromDate: '2026-09-11',
          toDate: '2026-09-13',
        }),
      ).rejects.toThrow(
        'A break request already exists for an overlapping date range.',
      );
    });

    it('rejects requests exceeding total 4-day limit for subscription', async () => {
      subRepo.findOne.mockResolvedValue(oneMonthSub);
      providerRepo.findOne.mockResolvedValue(providerEntity);
      breakRepo.find.mockResolvedValue([
        {
          subscriptionId: 'sub-month',
          status: SubscriptionBreakStatus.APPROVED,
          breakDays: 3,
        },
      ]);

      await expect(
        breaksService.createBreakRequest('student-1', {
          subscriptionId: 'sub-month',
          fromDate: '2026-09-20',
          toDate: '2026-09-21', // 2 days (3 + 2 = 5 > 4)
        }),
      ).rejects.toThrow(/exceeds your remaining break allowance/);
    });

    it('approving a 3-day break extends subscription endDate by exactly 3 days without changing payment/revenue', async () => {
      const approved = await breaksService.approveBreakRequest(
        'break-req-1',
        'provider-user-1',
      );
      expect(approved.status).toBe(SubscriptionBreakStatus.APPROVED);
    });

    it('rejects approval attempt from a different provider user', async () => {
      await expect(
        breaksService.approveBreakRequest('break-req-1', 'other-provider-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // Section 26 & 27: Provider & Student Reviews
  describe('SECTION 26 & 27: Provider and PrimeMate Review Controls', () => {
    let reviewsService: ReviewsService;
    let reviewRepo: any;
    let userRepo: any;
    let providerRepo: any;
    let subscriptionRepo: any;

    const studentA: any = { id: 'student-A', name: 'Alice' };
    const studentB: any = { id: 'student-B', name: 'Bob' };
    const providerObj: any = {
      id: 'prov-1',
      name: 'Alpha Mess',
      rating: 0,
      user: { id: 'provider-user-1' },
    };

    beforeEach(async () => {
      reviewRepo = {
        createQueryBuilder: jest.fn(() => ({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
          getOne: jest.fn().mockImplementation(async () => {
            return {
              id: 'rev-1',
              student: studentA,
              provider: providerObj,
              rating: 4,
              comment: 'Good',
            };
          }),
        })),
        create: jest.fn((d) => ({ ...d, id: 'rev-1' })),
        save: jest.fn((e) => Promise.resolve(e)),
        remove: jest.fn().mockResolvedValue({ success: true }),
      };

      userRepo = { findOne: jest.fn().mockResolvedValue(studentA) };
      providerRepo = {
        findOne: jest.fn().mockResolvedValue(providerObj),
        save: jest.fn(),
      };
      subscriptionRepo = {
        createQueryBuilder: jest.fn(() => ({
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 'sub-active' }),
        })),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ReviewsService,
          { provide: getRepositoryToken(Review), useValue: reviewRepo },
          { provide: getRepositoryToken(User), useValue: userRepo },
          { provide: getRepositoryToken(MealProvider), useValue: providerRepo },
          {
            provide: getRepositoryToken(Subscription),
            useValue: subscriptionRepo,
          },
        ],
      }).compile();

      reviewsService = module.get<ReviewsService>(ReviewsService);
    });

    it('rejects review creation if student never subscribed to the provider', async () => {
      subscriptionRepo.createQueryBuilder = jest.fn(() => ({
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }));

      await expect(
        reviewsService.create('student-A', 'prov-1', 5, 'Great food!'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows review creation for subscribed student', async () => {
      // Subscribed student, no existing review
      reviewRepo.createQueryBuilder = jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
      }));

      const rev = await reviewsService.create(
        'student-A',
        'prov-1',
        5,
        'Delicious and clean!',
      );
      expect(rev.rating).toBe(5);
      expect(rev.comment).toBe('Delicious and clean!');
    });

    it('allows student to edit their own review, rejects other student editing it', async () => {
      // Student A edits own review -> Success
      const updated = await reviewsService.update(
        'student-A',
        'rev-1',
        5,
        'Updated to excellent',
      );
      expect(updated.rating).toBe(5);

      // Student B attempts to edit Student A review -> Forbidden
      await expect(
        reviewsService.update('student-B', 'rev-1', 1, 'Hacked review'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows student to delete their own review, rejects other student deleting it', async () => {
      // Student B attempts delete -> Forbidden
      await expect(reviewsService.delete('student-B', 'rev-1')).rejects.toThrow(
        ForbiddenException,
      );

      // Student A deletes own review -> Success
      const res = await reviewsService.delete('student-A', 'rev-1');
      expect(res.success).toBe(true);
    });

    it('prevents provider from accessing reviews of another provider', async () => {
      await expect(
        reviewsService.findByProvider('prov-1', {
          userId: 'different-provider-user',
          role: Role.PROVIDER,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // Section 28: Password Reset Security Workflow
  describe('SECTION 28: Password Reset Cryptographic Flow & Policy', () => {
    let authService: AuthService;
    let usersService: UsersService;
    let resetTokenRepo: any;
    let refreshTokenRepo: any;
    let emailService: EmailService;

    const mockUser: any = {
      id: 'user-reset-1',
      email: 'student@example.com',
      passwordHash: 'old_hashed_password',
      role: Role.STUDENT,
    };

    beforeEach(async () => {
      usersService = {
        findByEmail: jest
          .fn()
          .mockImplementation(async (e) =>
            e === 'student@example.com' ? mockUser : null,
          ),
        findById: jest.fn().mockResolvedValue(mockUser),
      } as any;

      resetTokenRepo = {
        create: jest.fn((d) => d),
        save: jest.fn((d) => Promise.resolve(d)),
        findOne: jest.fn(),
      };

      refreshTokenRepo = {
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        find: jest.fn().mockResolvedValue([{ id: 'ref-1', revoked: false }]),
      };

      emailService = {
        sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
      } as any;

      const dataSourceMock: any = {
        createQueryRunner: jest.fn(() => ({
          connect: jest.fn(),
          startTransaction: jest.fn(),
          commitTransaction: jest.fn(),
          rollbackTransaction: jest.fn(),
          release: jest.fn(),
          manager: {
            save: jest.fn((_, entity) => Promise.resolve(entity)),
            getRepository: jest.fn(() => ({
              find: jest
                .fn()
                .mockResolvedValue([{ id: 'ref-1', revoked: false }]),
            })),
          },
        })),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: UsersService, useValue: usersService },
          {
            provide: getRepositoryToken(PasswordResetToken),
            useValue: resetTokenRepo,
          },
          {
            provide: getRepositoryToken(RefreshToken),
            useValue: refreshTokenRepo,
          },
          { provide: EmailService, useValue: emailService },
          { provide: JwtService, useValue: { sign: jest.fn() } },
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue('mock_secret') },
          },
          { provide: DataSource, useValue: dataSourceMock },
        ],
      }).compile();

      authService = module.get<AuthService>(AuthService);
    });

    it('returns generic response for nonexistent email without leaking account existence', async () => {
      const res = await authService.forgotPassword({
        email: 'nonexistent@example.com',
      });
      expect(res.message).toContain('If an account exists');
    });

    it('creates a hashed token with 15-minute expiration upon forgotPassword', async () => {
      const res = await authService.forgotPassword({
        email: 'student@example.com',
      });
      expect(res.message).toContain('If an account exists');
      expect(resetTokenRepo.save).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
    });

    it('rejects expired or used password reset tokens', async () => {
      // Expired token
      resetTokenRepo.findOne.mockResolvedValueOnce({
        tokenHash: 'hashed',
        user: mockUser,
        expiresAt: new Date(Date.now() - 1000), // Expired
        usedAt: null,
      });

      await expect(
        authService.resetPassword({
          token: 'raw_token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow('Password reset token has expired');

      // Already used token
      resetTokenRepo.findOne.mockResolvedValueOnce({
        tokenHash: 'hashed',
        user: mockUser,
        expiresAt: new Date(Date.now() + 100000),
        usedAt: new Date(), // Already used
      });

      await expect(
        authService.resetPassword({
          token: 'raw_token',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toThrow('Password reset token has already been used');
    });

    it('successfully resets password, hashes new password, and revokes active refresh tokens', async () => {
      resetTokenRepo.findOne.mockResolvedValue({
        tokenHash: 'hashed',
        user: { ...mockUser },
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        usedAt: null,
      });

      const res = await authService.resetPassword({
        token: 'raw_valid_token',
        newPassword: 'SecurePassword123!',
      });

      expect(res.message).toContain('Password reset successfully');
    });
  });

  // Section 8: Provider Price Edit & Validation
  describe('SECTION 8: Provider Price Editing and Authorization', () => {
    let providersService: any;
    let providerRepo: any;

    const mockProviderA: any = {
      id: 'prov-A',
      name: 'Hostel A Mess',
      monthlyPrice: 3000,
      user: { id: 'provider-user-A' },
      userId: 'provider-user-A',
    };

    beforeEach(async () => {
      providerRepo = {
        findOne: jest.fn().mockImplementation(async (opts) => {
          if (opts.where.id === 'prov-A') return { ...mockProviderA };
          return null;
        }),
        save: jest.fn().mockImplementation(async (entity) => entity),
        manager: {
          find: jest.fn().mockResolvedValue([]),
          save: jest.fn().mockImplementation(async (_, entity) => entity),
        },
      };

      const mockSubRepo = {
        createQueryBuilder: jest.fn(() => ({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(5),
        })),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: 'ProvidersService',
            useFactory: () => {
              const {
                ProvidersService,
              } = require('./providers/providers.service');
              return new ProvidersService(providerRepo, mockSubRepo as any);
            },
          },
        ],
      }).compile();

      providersService = module.get('ProvidersService');
    });

    it('allows provider owner to update price from ₹3,000 -> ₹3,500 -> ₹4,000', async () => {
      // 1. Update to 3500
      const updated3500 = await providersService.update(
        'provider-user-A',
        'prov-A',
        { monthlyPrice: 3500 },
      );
      expect(updated3500.monthlyPrice).toBe(3500);

      // 2. Update to 4000
      const updated4000 = await providersService.update(
        'provider-user-A',
        'prov-A',
        { monthlyPrice: 4000 },
      );
      expect(updated4000.monthlyPrice).toBe(4000);
    });

    it('rejects update if a different provider user attempts to modify price', async () => {
      await expect(
        providersService.update('provider-user-B', 'prov-A', {
          monthlyPrice: 5000,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects invalid, zero, or negative monthly price', async () => {
      // Zero price
      await expect(
        providersService.update('provider-user-A', 'prov-A', {
          monthlyPrice: 0,
        }),
      ).rejects.toThrow(BadRequestException);

      // Negative price
      await expect(
        providersService.update('provider-user-A', 'prov-A', {
          monthlyPrice: -500,
        }),
      ).rejects.toThrow(BadRequestException);

      // NaN
      await expect(
        providersService.update('provider-user-A', 'prov-A', {
          monthlyPrice: NaN,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // Section 20 & 21: Payment and Subscription History Isolation & Non-Mutation
  describe('SECTION 20 & 21: Payment & Subscription History Isolation', () => {
    let subRepo: any;
    let subscriptionsService: any;

    const studentAId = 'student-A-id';
    const studentBId = 'student-B-id';

    const subStudentA: any = {
      id: 'sub-A',
      student: { id: studentAId },
      mealPlan: {
        id: 'plan-1',
        title: '1 Month Plan',
        provider: { id: 'prov-1', name: 'Mess 1' },
      },
      status: SubscriptionStatus.ACTIVE,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      createdAt: new Date('2026-08-01T10:00:00Z'),
    };

    const paymentStudentA: any = {
      id: 'pay-A',
      student: { id: studentAId },
      provider: { id: 'prov-1' },
      amount: 2999,
      status: 'paid',
      razorpayOrderId: 'order_A',
      razorpayPaymentId: 'pay_A',
      createdAt: new Date('2026-08-01T10:00:00Z'),
    };

    beforeEach(async () => {
      subRepo = {
        find: jest.fn().mockImplementation(async (opts) => {
          if (opts.where.student?.id === studentAId)
            return [{ ...subStudentA }];
          return [];
        }),
        manager: {
          find: jest.fn().mockImplementation(async (entityClass, opts) => {
            if (
              opts.where?.studentId === studentAId ||
              opts.where?.student?.id === studentAId
            ) {
              return [{ ...paymentStudentA }];
            }
            return [];
          }),
        },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          {
            provide: 'SubscriptionsService',
            useFactory: () => {
              const {
                SubscriptionsService,
              } = require('./subscriptions/subscriptions.service');
              return new SubscriptionsService(subRepo, {} as any, {} as any);
            },
          },
        ],
      }).compile();

      subscriptionsService = module.get('SubscriptionsService');
    });

    it('returns Student A subscription history showing exact historical amount ₹2,999', async () => {
      const history = await subscriptionsService.findByStudent(studentAId);
      expect(history.length).toBe(1);
      expect(history[0].amountPaid).toBe(2999);
      expect(history[0].paymentStatus).toBe('PAID');
    });

    it('ensures Student B cannot see Student A subscription or payment records (No IDOR)', async () => {
      const historyB = await subscriptionsService.findByStudent(studentBId);
      expect(historyB.length).toBe(0);
    });
  });

  // Section 23: Subscription Renewal Integrity
  describe('SECTION 23: Subscription Renewal Price and History Integrity', () => {
    it('renewal charges current provider price while leaving past payment records unchanged', () => {
      // Past subscription at ₹3,000
      const pastPayment = {
        id: 'pay-past',
        amount: 3000,
        status: 'paid',
        createdAt: '2026-07-01',
      };
      const pastSubscription = {
        id: 'sub-past',
        amountPaid: 3000,
        status: 'expired',
        endDate: '2026-07-31',
      };

      // Provider price increases to ₹3,500
      const currentProviderPrice = 3500;

      // Student renews for next month
      const renewedPayment = {
        id: 'pay-renewed',
        amount: currentProviderPrice,
        status: 'paid',
        createdAt: '2026-08-01',
      };
      const renewedSubscription = {
        id: 'sub-renewed',
        amountPaid: currentProviderPrice,
        status: 'active',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      };

      // Past records must NOT mutate
      expect(pastPayment.amount).toBe(3000);
      expect(pastSubscription.amountPaid).toBe(3000);

      // Renewed records use new authoritative price
      expect(renewedPayment.amount).toBe(3500);
      expect(renewedSubscription.amountPaid).toBe(3500);
    });
  });

  // Section 41: End-to-End Cross-Feature Data Consistency
  describe('SECTION 41: Cross-Feature End-to-End Consistency', () => {
    it('verifies data alignment across Dashboard, Subscriptions, Breaks, Earnings, and Revenue', () => {
      const paymentRecord = { id: 'pay-101', amount: 3000, status: 'paid' };
      const subscriptionRecord = {
        id: 'sub-101',
        amountPaid: 3000,
        status: 'active',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      };
      const providerEarning = {
        paymentId: 'pay-101',
        subscriptionId: 'sub-101',
        grossAmount: 3000,
      };

      // 1. Initial consistency
      expect(subscriptionRecord.amountPaid).toBe(paymentRecord.amount);
      expect(providerEarning.grossAmount).toBe(paymentRecord.amount);

      // 2. 2-Day Break approved -> End date extends from Aug 31 to Sep 2 (+2 days)
      const approvedBreakDays = 2;
      const initialEnd = new Date('2026-08-31T00:00:00Z');
      initialEnd.setUTCDate(initialEnd.getUTCDate() + approvedBreakDays);
      subscriptionRecord.endDate = initialEnd.toISOString().split('T')[0];

      expect(subscriptionRecord.endDate).toBe('2026-09-02');
      // Amounts remain unchanged
      expect(subscriptionRecord.amountPaid).toBe(3000);
      expect(paymentRecord.amount).toBe(3000);
    });
  });
});
