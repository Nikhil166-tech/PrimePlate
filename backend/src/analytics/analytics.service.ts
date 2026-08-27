import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { User } from '../users/user.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/subscription.entity';
import { Payment } from '../payments/payment.entity';
import { ProviderApprovalStatus } from '../common/enums/provider-approval-status.enum';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(MealProvider)
    private providerRepo: Repository<MealProvider>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
  ) {}

  async getTotalUsers(): Promise<number> {
    return this.userRepo.count();
  }

  async getTotalProviders(): Promise<number> {
    return this.providerRepo.count({
      where: { approvalStatus: ProviderApprovalStatus.APPROVED },
    });
  }

  async getPendingApprovals(): Promise<number> {
    return this.providerRepo.count({
      where: { approvalStatus: ProviderApprovalStatus.PENDING },
    });
  }

  async getTotalSubscriptions(): Promise<number> {
    return this.subscriptionRepo.count({
      where: { status: SubscriptionStatus.ACTIVE },
    });
  }

  async getTotalRevenue(): Promise<number> {
    const revenueResult = await this.paymentRepo
      .createQueryBuilder('payment')
      .where('payment.status = :status', { status: 'paid' })
      .select('SUM(payment.amount)', 'total')
      .getRawOne();
    return Number(revenueResult?.total) || 0;
  }

  async getRevenueBreakdown() {
    const grossRevenue = await this.getTotalRevenue();
    const platformFees = 0; // Current 0% commission model
    const providerEarnings = grossRevenue - platformFees;

    return {
      grossRevenue,
      platformFees,
      providerEarnings,
    };
  }

  async getTodaysUsers(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.userRepo.count({
      where: { createdAt: MoreThanOrEqual(today) },
    });
  }

  async getMetrics() {
    const [
      totalUsers,
      totalProviders,
      pendingApprovals,
      activeSubscriptions,
      totalRevenue,
      todaysUsers,
      revenueBreakdown,
    ] = await Promise.all([
      this.getTotalUsers(),
      this.getTotalProviders(),
      this.getPendingApprovals(),
      this.getTotalSubscriptions(),
      this.getTotalRevenue(),
      this.getTodaysUsers(),
      this.getRevenueBreakdown(),
    ]);

    return {
      totalUsers,
      totalProviders,
      pendingApprovals,
      activeSubscriptions,
      totalRevenue,
      todaysUsers,
      grossRevenue: revenueBreakdown.grossRevenue,
      platformFees: revenueBreakdown.platformFees,
      providerEarnings: revenueBreakdown.providerEarnings,
    };
  }
}
