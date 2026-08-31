import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription, SubscriptionStatus } from './subscription.entity';
import { User } from '../users/user.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { Payment } from '../payments/payment.entity';
import { ProviderEarning } from '../payouts/provider-earning.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MealPlan)
    private readonly planRepo: Repository<MealPlan>,
  ) {}

  async create(
    studentId: string,
    mealPlanId: string,
    startDate?: string,
    endDate?: string,
    durationDays: number = 30,
  ): Promise<Subscription> {
    if (!studentId) {
      throw new BadRequestException('Student ID is required');
    }
    if (!mealPlanId) {
      throw new BadRequestException('Meal plan ID is required');
    }

    // Transactional Atomic Capacity Reservation
    return await this.subRepo.manager.transaction(async (manager) => {
      const student = await manager.findOne(User, { where: { id: studentId } });
      if (!student) {
        throw new NotFoundException('Student user not found');
      }

      const mealPlan = await manager.findOne(MealPlan, {
        where: { id: mealPlanId },
        relations: { provider: true },
      });
      if (!mealPlan) {
        throw new NotFoundException('Meal plan not found');
      }

      if (!mealPlan.provider) {
        throw new NotFoundException('Associated provider not found');
      }

      const providerId = mealPlan.provider.id;
      const dbType = manager.connection.options.type;

      // Apply pessimistic write lock cleanly on PostgreSQL driver
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

      if (!provider) {
        throw new NotFoundException('Provider record not found');
      }

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

      const start = startDate || new Date().toISOString().split('T')[0];
      const startObj = new Date(start);
      startObj.setDate(startObj.getDate() + (durationDays || 30));
      const end = endDate || startObj.toISOString().split('T')[0];

      const subscription = manager.create(Subscription, {
        student,
        mealPlan,
        status: SubscriptionStatus.ACTIVE,
        startDate: start,
        endDate: end,
      });

      return await manager.save(Subscription, subscription);
    });
  }

  async findByStudent(studentId: string): Promise<any[]> {
    if (!studentId) return [];
    const subs = await this.subRepo.find({
      where: { student: { id: studentId } },
      relations: { mealPlan: { provider: true } },
      order: { createdAt: 'DESC' },
    });

    const earnings = await this.subRepo.manager.find(ProviderEarning, {
      where: { studentId },
      relations: { payment: true },
    });

    const payments = await this.subRepo.manager.find(Payment, {
      where: { student: { id: studentId } },
      relations: { provider: true },
      order: { createdAt: 'DESC' },
    });

    return subs.map((sub: any) => {
      // 1. Direct link via ProviderEarning
      const earning = earnings.find((e) => e.subscriptionId === sub.id);
      let matchingPayment: any = earning?.payment;

      // 2. Direct match by created timestamp & provider if earning not present
      if (!matchingPayment) {
        matchingPayment = payments.find((p: any) => {
          if (p.provider?.id !== sub.mealPlan?.provider?.id) return false;
          const pTime = new Date(p.createdAt).getTime();
          const sTime = new Date(sub.createdAt).getTime();
          return Math.abs(pTime - sTime) <= 120000;
        });
      }

      const rawAmount = matchingPayment ? Number(matchingPayment.amount) : null;

      return {
        ...sub,
        amountPaid: rawAmount,
        razorpayOrderId: matchingPayment?.razorpayOrderId || null,
        razorpayPaymentId: matchingPayment?.razorpayPaymentId || null,
        paymentStatus: matchingPayment?.status
          ? String(matchingPayment.status).toUpperCase()
          : rawAmount !== null
            ? 'PAID'
            : 'UNKNOWN',
        paymentDate: matchingPayment?.createdAt || sub.createdAt,
      };
    });
  }

  async verifyProviderOwnership(
    userId: string,
    providerId: string,
  ): Promise<void> {
    const provider = await this.subRepo.manager.findOne(MealProvider, {
      where: { id: providerId },
      relations: { user: true },
    });
    if (!provider) {
      throw new NotFoundException('Provider kitchen not found');
    }
    if (provider.user?.id !== userId && provider.userId !== userId) {
      throw new ForbiddenException(
        'Cannot access subscribers belonging to another provider',
      );
    }
  }

  async findByProvider(providerId: string): Promise<any[]> {
    const subs = await this.subRepo.find({
      where: { mealPlan: { provider: { id: providerId } } },
      relations: { student: true, mealPlan: { provider: true } },
      order: { createdAt: 'DESC' },
    });

    const earnings = await this.subRepo.manager.find(ProviderEarning, {
      where: { providerId },
      relations: { payment: true },
    });

    const payments = await this.subRepo.manager.find(Payment, {
      where: { provider: { id: providerId }, status: 'paid' },
      relations: { student: true, provider: true },
      order: { createdAt: 'DESC' },
    });

    return subs.map((sub: any) => {
      const earning = earnings.find((e) => e.subscriptionId === sub.id);
      let matchingPayment: any = earning?.payment;

      if (!matchingPayment) {
        matchingPayment = payments.find((p: any) => {
          if (p.student?.id !== sub.student?.id) return false;
          if (p.createdAt && sub.createdAt) {
            const pTime = new Date(p.createdAt).getTime();
            const sTime = new Date(sub.createdAt).getTime();
            return Math.abs(pTime - sTime) <= 120000;
          }
          return true;
        });
      }

      if (!matchingPayment) {
        matchingPayment = payments.find(
          (p: any) => p.student?.id === sub.student?.id,
        );
      }

      const rawAmount = matchingPayment ? Number(matchingPayment.amount) : null;

      return {
        ...sub,
        amountPaid: rawAmount,
        razorpayOrderId: matchingPayment?.razorpayOrderId || null,
        razorpayPaymentId: matchingPayment?.razorpayPaymentId || null,
        paymentStatus: matchingPayment
          ? 'PAID'
          : rawAmount !== null
            ? 'PAID'
            : 'UNKNOWN',
        paymentDate: matchingPayment?.createdAt || sub.createdAt,
      };
    });
  }

  async pause(
    studentId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    const sub = await this.subRepo.findOne({
      where: { id: subscriptionId },
      relations: { student: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.student.id !== studentId) {
      throw new ForbiddenException(
        'Cannot modify subscription belonging to another user',
      );
    }

    sub.status = SubscriptionStatus.PAUSED;
    sub.pausedAt = new Date();
    return this.subRepo.save(sub);
  }

  async resume(
    studentId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    const sub = await this.subRepo.findOne({
      where: { id: subscriptionId },
      relations: { student: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.student.id !== studentId) {
      throw new ForbiddenException(
        'Cannot modify subscription belonging to another user',
      );
    }

    sub.status = SubscriptionStatus.ACTIVE;
    sub.pausedAt = undefined;
    return this.subRepo.save(sub);
  }

  async cancel(
    studentId: string,
    subscriptionId: string,
  ): Promise<Subscription> {
    const sub = await this.subRepo.findOne({
      where: { id: subscriptionId },
      relations: { student: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    if (sub.student.id !== studentId) {
      throw new ForbiddenException(
        'Cannot modify subscription belonging to another user',
      );
    }

    sub.status = SubscriptionStatus.CANCELLED;
    sub.cancelledAt = new Date();
    return this.subRepo.save(sub);
  }
}
