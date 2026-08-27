import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { ProviderEarning, ProviderEarningStatus } from './provider-earning.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { Payment } from '../payments/payment.entity';
import { Subscription } from '../subscriptions/subscription.entity';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    @InjectRepository(ProviderEarning)
    private readonly earningRepo: Repository<ProviderEarning>,
    @InjectRepository(MealProvider)
    private readonly providerRepo: Repository<MealProvider>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  /**
   * Resolves provider record associated with the authenticated user ID.
   */
  async getProviderByUserId(userId: string): Promise<MealProvider> {
    const provider = await this.providerRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!provider) {
      throw new NotFoundException('Meal provider profile not found for user');
    }
    return provider;
  }

  /**
   * Returns aggregated financial summary for the authenticated provider.
   */
  async getProviderSummary(userId: string) {
    const provider = await this.getProviderByUserId(userId);
    const earnings = await this.earningRepo.find({
      where: { providerId: provider.id },
    });

    let pendingAmount = 0;
    let paidAmount = 0;
    let refundedAmount = 0;
    let totalGross = 0;
    let platformFees = 0;

    for (const e of earnings) {
      const gAmt = Number(e.grossAmount) || 0;
      const pAmt = Number(e.providerAmount) || 0;
      const fee = Number(e.platformFee) || 0;
      const status = (e.status || '').toUpperCase();

      totalGross += gAmt;
      platformFees += fee;

      if (status === ProviderEarningStatus.PENDING || status === ProviderEarningStatus.ELIGIBLE) {
        pendingAmount += pAmt;
      } else if (status === ProviderEarningStatus.PAID) {
        paidAmount += pAmt;
      } else if (status === ProviderEarningStatus.REFUNDED) {
        refundedAmount += pAmt;
      }
    }

    const totalProviderEarnings = pendingAmount + paidAmount;

    return {
      totalGross,
      platformFees,
      totalProviderEarnings,
      pendingAmount,
      paidAmount,
      refundedAmount,
    };
  }

  /**
   * Returns detailed historical earnings ledger for authenticated provider.
   */
  async getProviderHistory(userId: string) {
    const provider = await this.getProviderByUserId(userId);
    const earnings = await this.earningRepo.find({
      where: { providerId: provider.id },
      relations: {
        payment: true,
        subscription: { mealPlan: true },
        student: true,
      },
      order: { earnedAt: 'DESC', createdAt: 'DESC' },
    });

    return earnings.map((e) => {
      const studentName = e.student?.name || 'Subscriber';
      const safeCustomerRef = {
        id: e.studentId,
        name: studentName,
      };

      const planTitle = e.subscription?.mealPlan?.title || 'Subscription Plan';
      const durationDays = (e.subscription?.mealPlan as any)?.durationDays || 30;

      return {
        id: e.id,
        date: e.earnedAt || e.createdAt,
        paymentReference: e.payment?.razorpayPaymentId || e.payment?.razorpayOrderId || e.paymentId,
        subscription: {
          id: e.subscriptionId,
          planTitle,
          durationDays,
        },
        customerReference: safeCustomerRef,
        grossAmount: Number(e.grossAmount),
        platformFee: Number(e.platformFee),
        providerAmount: Number(e.providerAmount),
        status: e.status,
      };
    });
  }

  /**
   * Creates a provider earning record idempotently.
   */
  async createEarningForPayment(
    payment: Payment,
    subscriptionId: string,
    manager?: EntityManager,
  ): Promise<ProviderEarning | null> {
    if (!payment || payment.status !== 'paid') {
      this.logger.warn(`Skipping provider earning creation for unverified/unpaid payment ${payment?.id}`);
      return null;
    }

    if (!payment.provider?.id || !payment.student?.id) {
      this.logger.warn(`Payment ${payment.id} missing provider or student association.`);
      return null;
    }

    const grossAmount = Number(payment.amount);
    const platformFee = 0; // Current 0% commission business model
    const providerAmount = grossAmount - platformFee;

    if (manager) {
      const existing = await manager.findOne(ProviderEarning, { where: { paymentId: payment.id } });
      if (existing) {
        this.logger.log(`Provider earning for payment ${payment.id} already exists (Idempotent reuse).`);
        return existing;
      }

      const earning = manager.create(ProviderEarning, {
        paymentId: payment.id,
        subscriptionId,
        providerId: payment.provider.id,
        studentId: payment.student.id,
        grossAmount,
        platformFee,
        providerAmount,
        status: ProviderEarningStatus.PENDING,
        earnedAt: new Date(),
      });

      try {
        return await manager.save(ProviderEarning, earning);
      } catch (err: any) {
        if (err.code === '23505' || err.message?.includes('duplicate') || err.message?.includes('UNIQUE')) {
          return await manager.findOne(ProviderEarning, { where: { paymentId: payment.id } });
        }
        throw err;
      }
    }

    const existing = await this.earningRepo.findOne({ where: { paymentId: payment.id } });
    if (existing) {
      this.logger.log(`Provider earning for payment ${payment.id} already exists (Idempotent reuse).`);
      return existing;
    }

    const earning = this.earningRepo.create({
      paymentId: payment.id,
      subscriptionId,
      providerId: payment.provider.id,
      studentId: payment.student.id,
      grossAmount,
      platformFee,
      providerAmount,
      status: ProviderEarningStatus.PENDING,
      earnedAt: new Date(),
    });

    try {
      return await this.earningRepo.save(earning);
    } catch (err: any) {
      if (err.code === '23505' || err.message?.includes('duplicate') || err.message?.includes('UNIQUE')) {
        return await this.earningRepo.findOne({ where: { paymentId: payment.id } });
      }
      throw err;
    }
  }

  /**
   * Updates provider earning status when payment is refunded.
   */
  async handlePaymentRefund(paymentId: string, manager?: EntityManager): Promise<ProviderEarning | null> {
    if (manager) {
      const earning = await manager.findOne(ProviderEarning, { where: { paymentId } });
      if (!earning) return null;
      earning.status = ProviderEarningStatus.REFUNDED;
      return await manager.save(ProviderEarning, earning);
    }

    const earning = await this.earningRepo.findOne({ where: { paymentId } });
    if (!earning) return null;
    earning.status = ProviderEarningStatus.REFUNDED;
    return await this.earningRepo.save(earning);
  }

  /**
   * Idempotent backfill capability for existing paid payments.
   */
  async backfillExistingPayments(manager?: EntityManager) {
    const mgr = manager || this.paymentRepo.manager;

    const paidPayments = await mgr.find(Payment, {
      where: { status: 'paid' },
      relations: { student: true, provider: true },
    });

    let createdCount = 0;
    for (const payment of paidPayments) {
      if (!payment.provider || !payment.student) continue;
      const existing = await mgr.findOne(ProviderEarning, {
        where: { paymentId: payment.id },
      });
      if (!existing) {
        const subs = await mgr.find(Subscription, {
          where: { student: { id: payment.student.id } },
          relations: { mealPlan: { provider: true } },
        });
        const matchingSub = subs.find(
          (s) => s.mealPlan?.provider?.id === payment.provider?.id,
        );

        await this.createEarningForPayment(payment, matchingSub?.id || '', mgr);
        createdCount++;
      }
    }

    return { totalPaidPayments: paidPayments.length, createdCount };
  }
}
