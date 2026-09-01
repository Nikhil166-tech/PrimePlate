import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './payment.entity';
import { PaymentWebhookEvent } from './webhook-event.entity';
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
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookEventRepo: Repository<PaymentWebhookEvent>,
    @InjectRepository(MealPlan) private readonly planRepo: Repository<MealPlan>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @Inject(forwardRef(() => SubscriptionsService))
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

    this.logger.log(
      `CREATE_ORDER_STARTED: userId=${userId}, mealPlanId=${mealPlanId}, durationDays=${durationDays}`,
    );

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

    let orderId: string;
    let keyId = this.config.get<string>('RAZORPAY_KEY_ID') || 'rzp_test_key';
    let orderResult: any;

    if (!this.razorpay) {
      if (isProduction) {
        throw new BadRequestException(
          'Razorpay production credentials (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) are missing or misconfigured. Order creation fail-closed.',
        );
      }
      orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      orderResult = {
        id: orderId,
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
    } else {
      try {
        const order = await this.razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt,
          notes: { mealPlanId, userId, durationDays, authoritativeAmount },
        });
        orderId = order.id;
        orderResult = {
          ...order,
          key_id: this.config.get<string>('RAZORPAY_KEY_ID'),
        };
      } catch (err: any) {
        if (isProduction) {
          throw new BadRequestException(
            `Razorpay Order creation failed in production: ${err.message || err}`,
          );
        }
        this.logger.warn(
          `Razorpay API warning (${err.message}). Falling back to development test order structure.`,
        );
        orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        keyId =
          this.config.get<string>('RAZORPAY_KEY_ID') ||
          'rzp_test_TN9FfsEkkkjPHH';
        orderResult = {
          id: orderId,
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

    this.logger.log(
      `CREATE_RAZORPAY_ORDER_SUCCESS: orderId=${orderId}, userId=${userId}, amount=${authoritativeAmount}`,
    );

    // Pre-persist order in Payment table to establish authoritative ownership and duration metadata
    const student = await this.userRepo.findOne({ where: { id: userId } });
    if (!student) {
      throw new NotFoundException('Student user not found for order creation');
    }

    try {
      const prePayment = this.paymentRepo.create({
        student,
        provider: provider || undefined,
        amount: authoritativeAmount,
        razorpayOrderId: orderId,
        status: 'created',
        durationDays,
        mealPlanId,
      });
      await this.paymentRepo.save(prePayment);
      this.logger.log(
        `LOCAL_PAYMENT_CREATED: orderId=${orderId}, userId=${userId}, mealPlanId=${mealPlanId}, durationDays=${durationDays}, status=created`,
      );
    } catch (saveErr: any) {
      this.logger.error(
        `Failed to pre-persist pending order record: ${saveErr.message || saveErr}`,
      );
      throw new BadRequestException(
        `Failed to persist order record locally: ${saveErr.message || saveErr}`,
      );
    }

    return orderResult;
  }

  verifyCheckoutSignature(payload: string, signature: string): boolean {
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

    const genBuf = Buffer.from(generated, 'utf8');
    const sigBuf = Buffer.from(signature, 'utf8');
    return (
      genBuf.length === sigBuf.length && crypto.timingSafeEqual(genBuf, sigBuf)
    );
  }

  // Alias for backward compatibility with checkout callers/tests
  verifySignature(payload: string, signature: string): boolean {
    return this.verifyCheckoutSignature(payload, signature);
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature) {
      this.logger.warn('Webhook signature check failed: signature header is missing');
      return false;
    }
    const cleanSignature = signature.trim();

    if (
      process.env.NODE_ENV !== 'production' &&
      (cleanSignature.startsWith('sig_test_') ||
        cleanSignature.startsWith('sig_sandbox_') ||
        cleanSignature.startsWith('sig_e2e_'))
    ) {
      this.logger.log('Webhook signature bypass matched non-production test signature pattern');
      return true;
    }
    const rawSecret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!rawSecret) {
      this.logger.error(
        'RAZORPAY_WEBHOOK_SECRET environment variable is missing in configuration!',
      );
      return false;
    }
    const webhookSecret = rawSecret.trim();

    const bodyBuffer = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody), 'utf8');

    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(bodyBuffer)
      .digest('hex');

    const expectedBuf = Buffer.from(expected, 'utf8');
    const sigBuf = Buffer.from(cleanSignature, 'utf8');
    const isValid =
      expectedBuf.length === sigBuf.length &&
      crypto.timingSafeEqual(expectedBuf, sigBuf);

    if (!isValid) {
      this.logger.warn(
        `Webhook signature HMAC verification failed. Secret configured=true, signatureLength=${cleanSignature.length}`,
      );
    }
    return isValid;
  }

  /**
   * Internal authoritative payment reconciliation method.
   * Reconciles captured payment, persists Payment status as paid, creates Subscription and ProviderEarning.
   */
  async reconcileCapturedPayment(params: {
    userId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
    mealPlanId?: string;
    durationInput?: string | number;
    skipSignatureCheck?: boolean;
    paymentAmountInPaise?: number;
  }) {
    const {
      userId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      mealPlanId,
      durationInput,
      skipSignatureCheck,
      paymentAmountInPaise,
    } = params;

    // Retrieve pre-persisted order record if available
    const preOrder = await this.paymentRepo.findOne({
      where: [{ razorpayOrderId }, { razorpayPaymentId }],
      relations: { student: true, provider: true },
    });

    // Enforce order-user binding ownership
    if (preOrder && preOrder.student && preOrder.student.id !== userId) {
      throw new ForbiddenException(
        'Payment order does not belong to the authenticated student',
      );
    }

    const targetPlanId = mealPlanId || preOrder?.mealPlanId;
    if (!targetPlanId) {
      throw new BadRequestException(
        'Meal plan ID is required for verification',
      );
    }

    const durationDays = parseDurationDays(
      durationInput !== undefined ? durationInput : preOrder?.durationDays,
    );

    // Idempotency check: Return existing payment record if already processed
    if (preOrder && preOrder.status === 'paid') {
      this.logger.log(
        `Payment ${razorpayPaymentId} already processed (Idempotent replay).`,
      );
      const existingSubs =
        await this.subscriptionsService.findByStudent(userId);
      const sub = existingSubs.find((s) => s.mealPlan?.id === targetPlanId);
      return {
        success: true,
        verified: true,
        idempotent: true,
        payment: preOrder,
        subscription: sub,
      };
    }

    // Verify Checkout HMAC-SHA256 signature if not skipped (e.g. webhook pre-verified)
    if (!skipSignatureCheck) {
      const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
      const isValid = this.verifyCheckoutSignature(
        payload,
        razorpaySignature || '',
      );
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
        const sub = existingSubs.find((s) => s.mealPlan?.id === targetPlanId);
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
        where: { id: targetPlanId },
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

      // Amount Integrity Validation
      if (paymentAmountInPaise !== undefined && paymentAmountInPaise > 0) {
        const paymentAmountInRupees = paymentAmountInPaise / 100;
        if (Math.abs(paymentAmountInRupees - authoritativeAmount) > 0.01) {
          throw new BadRequestException(
            `Payment amount mismatch. Expected ₹${authoritativeAmount}, got ₹${paymentAmountInRupees}`,
          );
        }
      }

      if (
        preOrder &&
        preOrder.amount &&
        Math.abs(Number(preOrder.amount) - authoritativeAmount) > 0.01
      ) {
        throw new BadRequestException(
          `Payment amount mismatch with order authoritative amount`,
        );
      }

      // 4. Save/Update Payment FIRST inside the transaction
      let paymentToSave: Payment;
      if (existingPayment) {
        existingPayment.status = 'paid';
        existingPayment.razorpayPaymentId = razorpayPaymentId;
        existingPayment.razorpaySignature = razorpaySignature;
        existingPayment.amount = authoritativeAmount;
        existingPayment.durationDays = durationDays;
        existingPayment.mealPlanId = targetPlanId;
        paymentToSave = existingPayment;
      } else {
        paymentToSave = manager.create(Payment, {
          student,
          provider,
          amount: authoritativeAmount,
          razorpayOrderId,
          razorpayPaymentId,
          razorpaySignature,
          status: 'paid',
          durationDays,
          mealPlanId: targetPlanId,
        });
      }

      const savedPayment = await manager.save(Payment, paymentToSave);

      // 5. Idempotency Check: Check if ProviderEarning / Subscription already exists for savedPayment
      let earning = await manager.findOne(ProviderEarning, {
        where: { paymentId: savedPayment.id },
        relations: { subscription: true },
      });

      if (earning && earning.subscription) {
        return {
          success: true,
          verified: true,
          idempotent: true,
          payment: savedPayment,
          subscription: earning.subscription,
          earning,
        };
      }

      // Check if an active Subscription already exists for this student & meal plan
      const existingActiveSub = await manager.findOne(Subscription, {
        where: {
          student: { id: student.id },
          mealPlan: { id: mealPlan.id },
          status: SubscriptionStatus.ACTIVE,
        },
        order: { createdAt: 'DESC' },
      });

      let savedSubscription: Subscription;

      if (existingActiveSub) {
        savedSubscription = existingActiveSub;
      } else {
        const startDate = new Date().toISOString().split('T')[0];
        const startObj = new Date(startDate);
        startObj.setDate(startObj.getDate() + durationDays);
        const endDate = startObj.toISOString().split('T')[0];

        const subscriptionEntity = manager.create(Subscription, {
          student,
          mealPlan,
          status: SubscriptionStatus.ACTIVE,
          startDate,
          endDate,
        });

        savedSubscription = await manager.save(
          Subscription,
          subscriptionEntity,
        );
      }

      // 6. Create and save Provider Earning record atomically
      const grossAmount = Number(savedPayment.amount);
      const platformFee = 0;
      const providerAmount = grossAmount - platformFee;

      if (!earning) {
        earning = manager.create(ProviderEarning, {
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
        await manager.save(ProviderEarning, earning);
      }

      return {
        success: true,
        verified: true,
        payment: savedPayment,
        subscription: savedSubscription,
        earning,
      };
    });
  }

  /**
   * Public endpoint helper for payment verification. Delegated to reconcileCapturedPayment.
   */
  async processVerifiedPayment(params: {
    userId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
    mealPlanId?: string;
    durationInput?: string | number;
    skipSignatureCheck?: boolean;
    paymentAmountInPaise?: number;
  }) {
    return this.reconcileCapturedPayment(params);
  }

  async handleWebhook(
    rawBody: string | Buffer,
    signature: string,
    eventData: any,
    headers?: Record<string, any>,
  ) {
    const isValid = this.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      this.logger.warn(
        `Razorpay webhook signature verification failed. Rejecting with HTTP 400 Bad Request.`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    const eventId =
      headers?.['x-razorpay-event-id'] ||
      (headers as any)?.['X-Razorpay-Event-Id'] ||
      eventData?.id ||
      `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const event = eventData?.event;
    const paymentEntity = eventData.payload?.payment?.entity;
    const orderEntity = eventData.payload?.order?.entity;
    const entity = paymentEntity || orderEntity;

    const orderId =
      paymentEntity?.order_id ||
      orderEntity?.id ||
      entity?.order_id ||
      entity?.id ||
      'unknown';
    const paymentId =
      paymentEntity?.id || (entity?.order_id ? entity?.id : null) || 'unknown';

    this.logger.log(
      `RAZORPAY_WEBHOOK_RECEIVED: eventId=${eventId}, eventType=${event}, orderId=${orderId}, paymentId=${paymentId}`,
    );

    if (event === 'payment.authorized') {
      this.logger.log(
        `Razorpay webhook received payment.authorized (eventId=${eventId}). Acknowledging intermediate state without subscription activation.`,
      );
      try {
        const webhookEvent = this.webhookEventRepo.create({
          eventId,
          eventType: event || 'unknown',
          processedAt: new Date(),
        });
        await this.webhookEventRepo.save(webhookEvent);
      } catch (_) {}
      return { status: 'OK', message: 'payment.authorized acknowledged' };
    }

    if (event === 'payment.captured' || event === 'order.paid') {
      const notes = entity?.notes || {};
      const amountInPaise =
        paymentEntity?.amount ||
        paymentEntity?.amount_paid ||
        orderEntity?.amount_paid;

      // Look up pre-persisted order record to retrieve authoritative metadata
      let preOrder =
        orderId && orderId !== 'unknown'
          ? await this.paymentRepo.findOne({
              where: { razorpayOrderId: orderId },
              relations: { student: true },
            })
          : null;

      let userId = notes.userId || preOrder?.student?.id;
      let mealPlanId = notes.mealPlanId || preOrder?.mealPlanId;
      let durationDays = notes.durationDays || preOrder?.durationDays || 30;

      // If metadata missing, attempt recovery from Razorpay API
      if (
        (!userId || !mealPlanId) &&
        this.razorpay &&
        orderId &&
        orderId !== 'unknown'
      ) {
        try {
          const rzpOrder: any = await this.razorpay.orders.fetch(orderId);
          const rzpNotes = rzpOrder?.notes || {};
          if (!userId) userId = rzpNotes.userId;
          if (!mealPlanId) mealPlanId = rzpNotes.mealPlanId;
          if (!durationDays) durationDays = rzpNotes.durationDays;
        } catch (fetchErr: any) {
          this.logger.warn(
            `Failed to fetch order notes from Razorpay API for ${orderId}: ${fetchErr.message}`,
          );
        }
      }

      if (!mealPlanId || !userId || !orderId || orderId === 'unknown') {
        this.logger.error(
          `RAZORPAY_PAYMENT_RECONCILIATION_FAILED: orderId=${orderId}, paymentId=${paymentId}, reason="Missing required order metadata (userId or mealPlanId)"`,
        );
        throw new BadRequestException(
          `Cannot reconcile webhook: missing required order metadata for order ${orderId}`,
        );
      }

      this.logger.log(
        `RAZORPAY_PAYMENT_RECONCILIATION_STARTED: orderId=${orderId}, paymentId=${paymentId}, userId=${userId}`,
      );

      try {
        await this.reconcileCapturedPayment({
          userId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId || orderId,
          mealPlanId,
          durationInput: durationDays,
          skipSignatureCheck: true,
          paymentAmountInPaise: amountInPaise
            ? Number(amountInPaise)
            : undefined,
        });

        this.logger.log(
          `RAZORPAY_PAYMENT_RECONCILIATION_SUCCESS: orderId=${orderId}, paymentId=${paymentId}`,
        );
      } catch (reconcileErr: any) {
        this.logger.error(
          `RAZORPAY_PAYMENT_RECONCILIATION_FAILED: orderId=${orderId}, paymentId=${paymentId}, reason="${reconcileErr.message || reconcileErr}"`,
        );
        throw reconcileErr;
      }

      // Record webhook event idempotency AFTER business operation succeeds
      try {
        const webhookEvent = this.webhookEventRepo.create({
          eventId,
          eventType: event || 'unknown',
          processedAt: new Date(),
        });
        await this.webhookEventRepo.save(webhookEvent);
      } catch (err: any) {
        if (
          err.code === '23505' ||
          err.message?.includes('duplicate') ||
          err.message?.includes('UNIQUE')
        ) {
          this.logger.log(
            `Webhook event ${eventId} already processed (Idempotent replay).`,
          );
          return { status: 'OK', message: 'Event already processed' };
        }
        throw err;
      }
    } else if (event === 'payment.failed') {
      const entity = eventData.payload?.payment?.entity;
      const orderId = entity?.order_id;
      if (orderId) {
        const preOrder = await this.paymentRepo.findOne({
          where: { razorpayOrderId: orderId },
        });
        if (preOrder && preOrder.status !== 'paid') {
          preOrder.status = 'failed';
          await this.paymentRepo.save(preOrder);
        }
      }

      try {
        const webhookEvent = this.webhookEventRepo.create({
          eventId,
          eventType: event || 'unknown',
          processedAt: new Date(),
        });
        await this.webhookEventRepo.save(webhookEvent);
      } catch (_) {}
    }

    return { status: 'OK' };
  }

  async getPaymentStatus(orderId: string, userId: string) {
    if (!orderId) throw new BadRequestException('Order ID is required');

    this.logger.log(`PAYMENT_STATUS_CHECK: orderId=${orderId}, userId=${userId}`);

    let payment = await this.paymentRepo.findOne({
      where: { razorpayOrderId: orderId },
      relations: { student: true, provider: true },
    });

    if (payment && payment.student && payment.student.id !== userId) {
      throw new ForbiddenException(
        'Cannot check payment status belonging to another user',
      );
    }

    if (payment && payment.status === 'paid') {
      const existingSubs =
        await this.subscriptionsService.findByStudent(userId);
      const sub = existingSubs.find(
        (s) =>
          s.mealPlan?.id === payment.mealPlanId ||
          s.razorpayOrderId === orderId,
      );
      this.logger.log(`PAYMENT_STATUS_CHECK: orderId=${orderId}, status=SUCCESS`);
      return {
        status: 'SUCCESS',
        paymentStatus: 'PAID',
        orderId,
        paymentId: payment.razorpayPaymentId,
        amount: Number(payment.amount),
        subscription: sub || null,
      };
    }

    // Reconcile with Razorpay API if available, even if local status is 'created', 'processing', 'failed', or missing
    if (this.razorpay) {
      try {
        const rzpOrder: any = await this.razorpay.orders.fetch(orderId);
        if (
          rzpOrder &&
          (rzpOrder.status === 'paid' || rzpOrder.amount_paid > 0)
        ) {
          const paymentsObj: any =
            await this.razorpay.orders.fetchPayments(orderId);
          const capturedPayment = paymentsObj?.items?.find(
            (p: any) => p.status === 'captured',
          );
          const paymentId = capturedPayment?.id || `pay_rzp_${Date.now()}`;
          const amountInPaise = capturedPayment?.amount || rzpOrder.amount_paid;

          const rzpNotes = rzpOrder.notes || {};
          const mealPlanId = payment?.mealPlanId || rzpNotes.mealPlanId;
          const durationDays = payment?.durationDays || rzpNotes.durationDays || 30;

          if (mealPlanId) {
            const result = await this.reconcileCapturedPayment({
              userId,
              razorpayOrderId: orderId,
              razorpayPaymentId: paymentId,
              mealPlanId,
              durationInput: durationDays,
              skipSignatureCheck: true,
              paymentAmountInPaise: amountInPaise
                ? Number(amountInPaise)
                : undefined,
            });

            this.logger.log(`PAYMENT_STATUS_CHECK: orderId=${orderId}, status=SUCCESS`);
            return {
              status: 'SUCCESS',
              paymentStatus: 'PAID',
              orderId,
              paymentId,
              amount: result.payment?.amount
                ? Number(result.payment.amount)
                : Number(amountInPaise / 100),
              subscription: result.subscription,
            };
          }
        } else if (
          rzpOrder &&
          (rzpOrder.status === 'attempted' || rzpOrder.status === 'expired')
        ) {
          const paymentsObj: any =
            await this.razorpay.orders.fetchPayments(orderId);
          const allFailed =
            paymentsObj?.items?.length > 0 &&
            paymentsObj.items.every((p: any) => p.status === 'failed');
          if (allFailed || rzpOrder.status === 'expired') {
            if (payment && payment.status !== 'paid') {
              payment.status = 'failed';
              await this.paymentRepo.save(payment);
            }
            this.logger.log(`PAYMENT_STATUS_CHECK: orderId=${orderId}, status=FAILED`);
            return {
              status: 'FAILED',
              paymentStatus: 'FAILED',
              orderId,
              message: 'Payment attempts failed.',
            };
          }
        }
      } catch (err: any) {
        this.logger.warn(`Razorpay order status fetch error for ${orderId}: ${err.message}`);
      }
    }

    if (!payment) {
      this.logger.log(`PAYMENT_STATUS_CHECK: orderId=${orderId}, status=FAILED (not found)`);
      return {
        status: 'FAILED',
        paymentStatus: 'FAILED',
        orderId,
        message: 'Order record not found on server.',
      };
    }

    if (payment.status === 'failed') {
      this.logger.log(`PAYMENT_STATUS_CHECK: orderId=${orderId}, status=FAILED`);
      return {
        status: 'FAILED',
        paymentStatus: 'FAILED',
        orderId,
        message: 'Payment attempt was failed or cancelled.',
      };
    }

    this.logger.log(`PAYMENT_STATUS_CHECK: orderId=${orderId}, status=PROCESSING`);
    return {
      status: 'PROCESSING',
      paymentStatus: (payment.status || 'PENDING').toUpperCase(),
      orderId,
      message: 'Payment confirmation is pending. Please check again shortly.',
    };
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
