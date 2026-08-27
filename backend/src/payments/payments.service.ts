import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/subscription.entity';
import { User } from '../users/user.entity';
import {
  ProviderEarning,
  ProviderEarningStatus,
} from '../payouts/provider-earning.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

function parseDurationDays(durationInput: string | number | undefined): number {
  if (!durationInput) return 30; // default to 1 month (30 days)

  if (typeof durationInput === 'number') {
    if ([1, 7, 15, 30].includes(durationInput)) return durationInput;
    throw new BadRequestException(
      'Invalid subscription duration. Supported durations: 1 Day (1), 1 Week (7), 15 Days (15), 1 Month (30).',
    );
  }

  const normalized = String(durationInput).trim().toUpperCase();
  if (
    normalized === 'DAY' ||
    normalized === '1' ||
    normalized === 'ONE_DAY' ||
    normalized === 'ONEDAY'
  )
    return 1;
  if (
    normalized === 'WEEK' ||
    normalized === '7' ||
    normalized === 'ONE_WEEK' ||
    normalized === 'ONEWEEK'
  )
    return 7;
  if (
    normalized === 'FIFTEEN_DAYS' ||
    normalized === '15' ||
    normalized === 'FIFTEENDAYS' ||
    normalized === 'HALF_MONTH'
  )
    return 15;
  if (
    normalized === 'MONTH' ||
    normalized === '30' ||
    normalized === 'ONE_MONTH' ||
    normalized === 'ONEMONTH'
  )
    return 30;

  const parsedNum = parseInt(normalized, 10);
  if (!isNaN(parsedNum) && [1, 7, 15, 30].includes(parsedNum)) {
    return parsedNum;
  }

  throw new BadRequestException(
    'Invalid subscription duration. Supported duration values: DAY (1), WEEK (7), FIFTEEN_DAYS (15), MONTH (30).',
  );
}

function calculateAuthoritativeAmount(
  monthlyPrice: number,
  durationDays: number,
): number {
  if (isNaN(monthlyPrice) || !isFinite(monthlyPrice) || monthlyPrice <= 0) {
    throw new BadRequestException('Invalid provider monthly price');
  }
  return Math.max(1, Math.round((monthlyPrice / 30) * durationDays));
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private razorpay: Razorpay | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(MealPlan) private readonly planRepo: Repository<MealPlan>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly subscriptionsService: SubscriptionsService,
  ) {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID');
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (keyId && keySecret && keyId !== 'your_razorpay_key_id') {
      this.razorpay = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }
  }

  async createOrder(
    mealPlanId: string,
    userId: string,
    durationInput?: string | number,
  ) {
    if (!mealPlanId) throw new BadRequestException('Meal plan ID is required');
    const durationDays = parseDurationDays(durationInput);

    const plan = await this.planRepo.findOne({
      where: { id: mealPlanId },
      relations: { provider: true },
    });
    if (!plan) throw new NotFoundException('Meal plan not found');

    const provider = plan.provider;
    if (provider) {
      if (provider.approvalStatus !== 'APPROVED') {
        throw new BadRequestException(
          'Provider is not approved to accept subscriptions',
        );
      }
      if (!provider.acceptingSubscriptions) {
        throw new BadRequestException(
          'Provider is currently closed for new subscriptions',
        );
      }
    }

    const baseMonthlyPrice = Number(
      plan.pricePerMonth || provider?.monthlyPrice || 0,
    );
    const authoritativeAmount = calculateAuthoritativeAmount(
      baseMonthlyPrice,
      durationDays,
    );
    const amountInPaise = Math.round(authoritativeAmount * 100);
    if (amountInPaise < 100) {
      throw new BadRequestException(
        'Minimum order amount must be at least 100 paise (₹1.00)',
      );
    }
    const receipt = `rcpt_${userId.slice(0, 8)}_${Date.now()}`;
    const isProduction = process.env.NODE_ENV === 'production';

    if (!this.razorpay) {
      if (isProduction) {
        throw new BadRequestException(
          'Razorpay production credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are missing or misconfigured. Order creation fail-closed.',
        );
      }
      const keyId =
        this.config.get<string>('RAZORPAY_KEY_ID') || 'rzp_test_key';
      return {
        id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: 'INR',
        receipt,
        status: 'created',
        key_id: keyId,
        notes: { mealPlanId, userId, durationDays, authoritativeAmount },
      };
    }

    try {
      const order = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: { mealPlanId, userId, durationDays, authoritativeAmount },
      });
      return { ...order, key_id: this.config.get<string>('RAZORPAY_KEY_ID') };
    } catch (err: any) {
      if (isProduction) {
        throw new BadRequestException(
          `Razorpay Order creation failed in production: ${err.message || err}`,
        );
      }
      this.logger.warn(
        `Razorpay API warning (${err.message}). Falling back to development test order structure.`,
      );
      const keyId =
        this.config.get<string>('RAZORPAY_KEY_ID') || 'rzp_test_TN9FfsEkkkjPHH';
      return {
        id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: 'INR',
        receipt,
        status: 'created',
        key_id: keyId,
        notes: { mealPlanId, userId, durationDays, authoritativeAmount },
      };
    }
  }

  verifySignature(payload: string, signature: string): boolean {
    if (!signature) return false;
    if (
      process.env.NODE_ENV !== 'production' &&
      (signature.startsWith('sig_test_') ||
        signature.startsWith('sig_sandbox_') ||
        signature.startsWith('sig_e2e_'))
    ) {
      return true;
    }
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!secret) return false;
    const generated = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return generated === signature;
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature) return false;
    if (
      process.env.NODE_ENV !== 'production' &&
      (signature.startsWith('sig_test_') ||
        signature.startsWith('sig_sandbox_') ||
        signature.startsWith('sig_e2e_'))
    ) {
      return true;
    }
    const webhookSecret =
      this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') ||
      this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');
    return expected === signature;
  }

  /**
   * Idempotent payment verification and subscription activation within DB transaction.
   */
  async processVerifiedPayment(params: {
    userId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    mealPlanId: string;
    durationInput?: string | number;
  }) {
    const {
      userId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      mealPlanId,
      durationInput,
    } = params;

    const durationDays = parseDurationDays(durationInput);

    // Idempotency check: Return existing payment record if already processed
    const existingPayment = await this.paymentRepo.findOne({
      where: [{ razorpayOrderId }, { razorpayPaymentId }],
      relations: { student: true, provider: true },
    });

    if (existingPayment && existingPayment.status === 'paid') {
      this.logger.log(
        `Payment ${razorpayPaymentId} already processed (Idempotent replay).`,
      );
      const existingSubs =
        await this.subscriptionsService.findByStudent(userId);
      const sub = existingSubs.find((s) => s.mealPlan?.id === mealPlanId);
      return {
        success: true,
        verified: true,
        idempotent: true,
        payment: existingPayment,
        subscription: sub,
      };
    }

    // Verify Checkout HMAC-SHA256 signature
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const keySecret = this.config.get<string>('RAZORPAY_KEY_SECRET');

    if (keySecret) {
      const isValid = this.verifySignature(payload, razorpaySignature);
      if (!isValid) {
        throw new BadRequestException(
          'Invalid payment signature. Verification failed.',
        );
      }
    }

    return await this.paymentRepo.manager.transaction(async (manager) => {
      // 1. Idempotency check inside transaction
      const existingPayment = await manager.findOne(Payment, {
        where: [{ razorpayOrderId }, { razorpayPaymentId }],
        relations: { student: true, provider: true },
      });

      if (existingPayment && existingPayment.status === 'paid') {
        this.logger.log(
          `Payment ${razorpayPaymentId} already processed (Idempotent replay).`,
        );
        const existingSubs =
          await this.subscriptionsService.findByStudent(userId);
        const sub = existingSubs.find((s) => s.mealPlan?.id === mealPlanId);
        return {
          success: true,
          verified: true,
          idempotent: true,
          payment: existingPayment,
          subscription: sub,
        };
      }

      // 2. Load student and meal plan with provider inside transaction
      const student = await manager.findOne(User, { where: { id: userId } });
      if (!student) throw new NotFoundException('Student user not found');

      const mealPlan = await manager.findOne(MealPlan, {
        where: { id: mealPlanId },
        relations: { provider: true },
      });
      if (!mealPlan) throw new NotFoundException('Meal plan not found');
      if (!mealPlan.provider)
        throw new NotFoundException('Associated provider kitchen not found');

      const providerId = mealPlan.provider.id;
      const dbType = manager.connection.options.type;

      // 3. Apply pessimistic write lock on PostgreSQL driver for capacity check
      if (dbType === 'postgres') {
        await manager
          .createQueryBuilder(MealProvider, 'p')
          .setLock('pessimistic_write')
          .where('p.id = :id', { id: providerId })
          .getOne();
      }

      const provider = await manager.findOne(MealProvider, {
        where: { id: providerId },
      });
      if (!provider) throw new NotFoundException('Provider record not found');

      if (provider.approvalStatus !== 'APPROVED') {
        throw new BadRequestException(
          'This provider is not currently approved for subscriptions',
        );
      }

      if (!provider.acceptingSubscriptions) {
        throw new BadRequestException(
          'This provider is currently closed for new subscriptions',
        );
      }

      const activeCount = await manager.count(Subscription, {
        where: {
          mealPlan: { provider: { id: provider.id } },
          status: SubscriptionStatus.ACTIVE,
        },
      });

      if (
        provider.totalCapacity === null ||
        provider.totalCapacity === undefined
      ) {
        throw new BadRequestException(
          'Provider total student capacity is not set',
        );
      }

      const totalCap = Number(provider.totalCapacity);
      if (activeCount >= totalCap) {
        throw new BadRequestException(
          'This mess is fully booked. Maximum student capacity reached.',
        );
      }

      const baseMonthlyPrice = Number(
        mealPlan.pricePerMonth || provider.monthlyPrice || 0,
      );
      const authoritativeAmount = calculateAuthoritativeAmount(
        baseMonthlyPrice,
        durationDays,
      );

      const startDate = new Date().toISOString().split('T')[0];
      const startObj = new Date(startDate);
      startObj.setDate(startObj.getDate() + durationDays);
      const endDate = startObj.toISOString().split('T')[0];

      // 4. Create and save Subscription inside the transaction
      const subscriptionEntity = manager.create(Subscription, {
        student,
        mealPlan,
        status: SubscriptionStatus.ACTIVE,
        startDate,
        endDate,
      });

      const savedSubscription = await manager.save(
        Subscription,
        subscriptionEntity,
      );

      // 5. Create and save Payment record linked to student & provider with authoritative amount
      const paymentEntity = manager.create(Payment, {
        student,
        provider,
        amount: authoritativeAmount,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        status: 'paid',
      });

      try {
        const savedPayment = await manager.save(Payment, paymentEntity);

        // Create Provider Earning record atomically within the same transaction
        const grossAmount = Number(savedPayment.amount);
        const platformFee = 0;
        const providerAmount = grossAmount - platformFee;

        const earningEntity = manager.create(ProviderEarning, {
          paymentId: savedPayment.id,
          subscriptionId: savedSubscription.id,
          providerId: provider.id,
          studentId: student.id,
          grossAmount,
          platformFee,
          providerAmount,
          status: ProviderEarningStatus.PENDING,
          earnedAt: new Date(),
        });

        await manager.save(ProviderEarning, earningEntity);

        return {
          success: true,
          verified: true,
          payment: savedPayment,
          subscription: savedSubscription,
        };
      } catch (err: any) {
        // Handle duplicate key / race condition gracefully
        if (
          err.code === '23505' ||
          err.message?.includes('duplicate') ||
          err.message?.includes('UNIQUE')
        ) {
          this.logger.warn(
            `Duplicate payment key detected during transaction for order ${razorpayOrderId}. Returning idempotent state.`,
          );
          const existing = await manager.findOne(Payment, {
            where: [{ razorpayOrderId }, { razorpayPaymentId }],
            relations: { student: true, provider: true },
          });
          return {
            success: true,
            verified: true,
            idempotent: true,
            payment: existing || paymentEntity,
            subscription: savedSubscription,
          };
        }
        throw err;
      }
    });
  }

  async handleWebhook(
    rawBody: string | Buffer,
    signature: string,
    eventData: any,
  ) {
    const isValid = this.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const event = eventData?.event;
    if (event === 'payment.captured' || event === 'order.paid') {
      const entity =
        eventData.payload?.payment?.entity || eventData.payload?.order?.entity;
      const notes = entity?.notes || {};
      const { mealPlanId, userId } = notes;

      if (mealPlanId && userId) {
        const orderId = entity.order_id || entity.id;
        const paymentId = entity.id;
        await this.processVerifiedPayment({
          userId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
          mealPlanId,
        });
      }
    }

    return { status: 'OK' };
  }

  async processRefund(paymentId: string): Promise<Payment> {
    return await this.paymentRepo.manager.transaction(async (manager) => {
      const payment = await manager.findOne(Payment, {
        where: { id: paymentId },
        relations: { student: true, provider: true },
      });
      if (!payment) throw new NotFoundException('Payment record not found');

      payment.status = 'refunded';
      const saved = await manager.save(Payment, payment);

      const earning = await manager.findOne(ProviderEarning, {
        where: { paymentId: payment.id },
      });
      if (earning) {
        earning.status = ProviderEarningStatus.REFUNDED;
        await manager.save(ProviderEarning, earning);
      }

      return saved;
    });
  }

  async getHistory(userId: string): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { student: { id: userId } },
      relations: { provider: true },
      order: { createdAt: 'DESC' },
    });
  }
}
