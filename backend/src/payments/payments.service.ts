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
import { User } from '../users/user.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import * as crypto from 'crypto';
import Razorpay from 'razorpay';

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

  async createOrder(mealPlanId: string, userId: string) {
    if (!mealPlanId) throw new BadRequestException('Meal plan ID is required');
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

    const amountInPaise = Math.round(plan.pricePerMonth * 100);
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
        notes: { mealPlanId, userId },
      };
    }

    try {
      const order = await this.razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: { mealPlanId, userId },
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
        notes: { mealPlanId, userId },
      };
    }
  }

  verifySignature(payload: string, signature: string): boolean {
    if (!signature) return false;
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET');
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        return false;
      }
      // Allow local development/test signature prefixes in non-production mode
      if (signature.startsWith('sig_test_') || signature.startsWith('sig_sandbox_') || signature.startsWith('sig_e2e_')) {
        return true;
      }
      return false;
    }
    const generated = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return generated === signature;
  }

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): boolean {
    if (!signature) return false;
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
  }) {
    const {
      userId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      mealPlanId,
    } = params;

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

    const student = await this.userRepo.findOne({ where: { id: userId } });
    if (!student) throw new NotFoundException('Student user not found');

    const mealPlan = await this.planRepo.findOne({
      where: { id: mealPlanId },
      relations: { provider: true },
    });
    if (!mealPlan) throw new NotFoundException('Meal plan not found');

    // Create Subscription first to enforce atomic capacity check inside transaction
    const subscription = await this.subscriptionsService.create(
      userId,
      mealPlanId,
    );

    // Save Payment record linked to student & provider
    const payment = this.paymentRepo.create({
      student,
      provider: mealPlan.provider,
      amount: mealPlan.pricePerMonth,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      status: 'paid',
    });

    const savedPayment = await this.paymentRepo.save(payment);

    return {
      success: true,
      verified: true,
      payment: savedPayment,
      subscription,
    };
  }

  async handleWebhook(rawBody: string | Buffer, signature: string, eventData: any) {
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

  async getHistory(userId: string): Promise<Payment[]> {
    return this.paymentRepo.find({
      where: { student: { id: userId } },
      relations: { provider: true },
      order: { createdAt: 'DESC' },
    });
  }
}
