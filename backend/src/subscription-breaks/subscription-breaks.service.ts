import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  SubscriptionBreakRequest,
  SubscriptionBreakStatus,
} from './subscription-break-request.entity';
import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/subscription.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { User } from '../users/user.entity';
import { CreateBreakRequestDto } from './dto/create-break-request.dto';

function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

function calculateInclusiveDays(
  fromDateStr: string,
  toDateStr: string,
): number {
  const from = new Date(fromDateStr + 'T00:00:00Z');
  const to = new Date(toDateStr + 'T00:00:00Z');
  const diffTime = to.getTime() - from.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

@Injectable()
export class SubscriptionBreaksService {
  constructor(
    @InjectRepository(SubscriptionBreakRequest)
    private readonly breakRepo: Repository<SubscriptionBreakRequest>,
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(MealProvider)
    private readonly providerRepo: Repository<MealProvider>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async createBreakRequest(
    studentUserId: string,
    dto: CreateBreakRequestDto,
  ): Promise<SubscriptionBreakRequest> {
    const student = await this.userRepo.findOne({
      where: { id: studentUserId },
    });
    if (!student) {
      throw new NotFoundException('Student user not found');
    }

    const sub = await this.subRepo.findOne({
      where: { id: dto.subscriptionId },
      relations: { student: true, mealPlan: { provider: true } },
    });

    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }

    if (sub.student?.id !== studentUserId) {
      throw new ForbiddenException(
        'Cannot request break for a subscription belonging to another user',
      );
    }

    if (sub.status !== SubscriptionStatus.ACTIVE) {
      throw new BadRequestException(
        'Subscription break can only be requested for active subscriptions',
      );
    }

    // 1-MONTH SUBSCRIPTION ELIGIBILITY CHECK
    const totalInitialDuration = calculateInclusiveDays(
      sub.startDate,
      sub.endDate || sub.startDate,
    );
    const planTitleLower = (sub.mealPlan?.title || '').toLowerCase();

    const isHalfMonth =
      planTitleLower.includes('15 day') ||
      planTitleLower.includes('half-month') ||
      planTitleLower.includes('half month');
    const isOneDay =
      planTitleLower.includes('1 day') ||
      planTitleLower.includes('one day') ||
      totalInitialDuration <= 3;
    const isOneWeek =
      planTitleLower.includes('1 week') ||
      planTitleLower.includes('one week') ||
      planTitleLower.includes('7 day');

    const isOneMonthPlan =
      !isHalfMonth &&
      !isOneDay &&
      !isOneWeek &&
      (totalInitialDuration >= 25 ||
        planTitleLower.includes('1 month') ||
        planTitleLower.includes('one month') ||
        (planTitleLower.includes('month') && !planTitleLower.includes('half')));

    if (!isOneMonthPlan) {
      throw new BadRequestException(
        'Subscription breaks are available only for 1-month subscriptions.',
      );
    }

    const provider = sub.mealPlan?.provider;
    if (!provider) {
      throw new NotFoundException(
        'Provider kitchen not found for this subscription',
      );
    }

    const providerRecord = await this.providerRepo.findOne({
      where: { id: provider.id },
    });
    if (!providerRecord || !providerRecord.subscriptionBreaksEnabled) {
      throw new BadRequestException(
        'Subscription breaks are not available for this provider.',
      );
    }

    // Date range validation
    const todayStr = new Date().toISOString().split('T')[0];
    if (dto.fromDate < todayStr) {
      throw new BadRequestException('Break start date cannot be in the past');
    }

    if (dto.toDate < dto.fromDate) {
      throw new BadRequestException('End date must be on or after start date');
    }

    if (
      dto.fromDate < sub.startDate ||
      (sub.endDate && dto.toDate > sub.endDate)
    ) {
      throw new BadRequestException(
        'Break dates must fall within the subscription active period',
      );
    }

    const breakDays = calculateInclusiveDays(dto.fromDate, dto.toDate);
    if (breakDays < 1 || breakDays > 4) {
      throw new BadRequestException(
        'Break duration must be between 1 and 4 days.',
      );
    }

    // 4-Day allowance check (only APPROVED days count toward the limit)
    const approvedBreaks = await this.breakRepo.find({
      where: {
        subscriptionId: sub.id,
        status: SubscriptionBreakStatus.APPROVED,
      },
    });

    const usedDays = approvedBreaks.reduce((sum, r) => sum + r.breakDays, 0);
    if (usedDays >= 4) {
      throw new BadRequestException(
        "You've used all 4 break days for this subscription.",
      );
    }

    if (usedDays + breakDays > 4) {
      throw new BadRequestException(
        `Requested break of ${breakDays} days exceeds your remaining break allowance of ${4 - usedDays} days.`,
      );
    }

    // Overlapping request check (PENDING or APPROVED)
    const existingRequests = await this.breakRepo.find({
      where: [
        { subscriptionId: sub.id, status: SubscriptionBreakStatus.PENDING },
        { subscriptionId: sub.id, status: SubscriptionBreakStatus.APPROVED },
      ],
    });

    const hasOverlap = existingRequests.some(
      (r) => r.fromDate <= dto.toDate && r.toDate >= dto.fromDate,
    );

    if (hasOverlap) {
      throw new BadRequestException(
        'A break request already exists for an overlapping date range.',
      );
    }

    const breakReq = this.breakRepo.create({
      subscription: sub,
      subscriptionId: sub.id,
      student,
      studentId: student.id,
      provider: providerRecord,
      providerId: providerRecord.id,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      breakDays,
      reason: dto.reason,
      status: SubscriptionBreakStatus.PENDING,
      requestedAt: new Date(),
    });

    return await this.breakRepo.save(breakReq);
  }

  async getMyBreakRequests(studentUserId: string): Promise<any> {
    const requests = await this.breakRepo.find({
      where: { studentId: studentUserId },
      relations: { subscription: true, provider: true },
      order: { requestedAt: 'DESC' },
    });

    // Group by subscription to calculate usage
    const subMap: Record<string, number> = {};
    requests.forEach((r) => {
      if (r.status === SubscriptionBreakStatus.APPROVED) {
        subMap[r.subscriptionId] =
          (subMap[r.subscriptionId] || 0) + r.breakDays;
      }
    });

    return {
      requests: requests.map((r) => ({
        ...r,
        studentName: r.student?.name || r.student?.email,
        providerName: r.provider?.name,
      })),
      usageBySubscription: subMap,
    };
  }

  async getProviderBreakRequests(
    providerId: string,
    providerUserId: string,
  ): Promise<any[]> {
    const provider = await this.providerRepo.findOne({
      where: { id: providerId },
      relations: { user: true },
    });

    if (!provider) {
      throw new NotFoundException('Provider kitchen not found');
    }

    if (
      provider.user?.id !== providerUserId &&
      provider.userId !== providerUserId
    ) {
      throw new ForbiddenException(
        'Cannot access break requests for another provider',
      );
    }

    const requests = await this.breakRepo.find({
      where: { providerId },
      relations: { student: true, subscription: { mealPlan: true } },
      order: { requestedAt: 'DESC' },
    });

    // Attach approved breakdown count per subscription
    const subIds = [...new Set(requests.map((r) => r.subscriptionId))];
    const approvedUsageMap: Record<string, number> = {};

    if (subIds.length > 0) {
      const allApproved = await this.breakRepo
        .createQueryBuilder('b')
        .where('b.subscriptionId IN (:...subIds)', { subIds })
        .andWhere('b.status = :status', {
          status: SubscriptionBreakStatus.APPROVED,
        })
        .getMany();

      allApproved.forEach((b) => {
        approvedUsageMap[b.subscriptionId] =
          (approvedUsageMap[b.subscriptionId] || 0) + b.breakDays;
      });
    }

    return requests.map((r) => {
      const currentEnd = r.subscription?.endDate;
      const calculatedNewEnd = currentEnd
        ? addDaysToDateString(currentEnd, r.breakDays)
        : null;
      return {
        ...r,
        studentName: r.student?.name || r.student?.email || 'Subscriber',
        planTitle: r.subscription?.mealPlan?.title || '1 Month Plan',
        currentEndDate: currentEnd,
        calculatedNewEndDate: calculatedNewEnd,
        approvedBreakDaysCount: approvedUsageMap[r.subscriptionId] || 0,
      };
    });
  }

  async approveBreakRequest(
    requestId: string,
    providerUserId: string,
  ): Promise<SubscriptionBreakRequest> {
    return await this.dataSource.transaction(async (manager) => {
      const dbType = manager.connection?.options?.type;
      if (dbType === 'postgres') {
        await manager
          .createQueryBuilder(SubscriptionBreakRequest, 'r')
          .setLock('pessimistic_write')
          .where('r.id = :id', { id: requestId })
          .getOne();
      }

      const req = await manager.findOne(SubscriptionBreakRequest, {
        where: { id: requestId },
        relations: { subscription: true, provider: { user: true } },
      });

      if (!req) {
        throw new NotFoundException('Subscription break request not found');
      }

      if (req.status !== SubscriptionBreakStatus.PENDING) {
        throw new BadRequestException(
          `Break request has already been ${req.status.toLowerCase()}`,
        );
      }

      if (
        req.provider.user?.id !== providerUserId &&
        req.provider.userId !== providerUserId
      ) {
        throw new ForbiddenException(
          'Cannot approve break request for another provider',
        );
      }

      if (!req.provider.subscriptionBreaksEnabled) {
        throw new BadRequestException(
          'Subscription breaks are not enabled for this provider',
        );
      }

      // Check current approved days limit
      const approvedBreaks = await manager.find(SubscriptionBreakRequest, {
        where: {
          subscriptionId: req.subscriptionId,
          status: SubscriptionBreakStatus.APPROVED,
        },
      });

      const currentApprovedDays = approvedBreaks.reduce(
        (sum, b) => sum + b.breakDays,
        0,
      );
      if (currentApprovedDays + req.breakDays > 4) {
        throw new BadRequestException(
          'Approved break days for this subscription would exceed the 4-day maximum limit.',
        );
      }

      // Update status to APPROVED inside transaction
      req.status = SubscriptionBreakStatus.APPROVED;
      req.approvedAt = new Date();
      req.approvedById = providerUserId;
      const savedReq = await manager.save(SubscriptionBreakRequest, req);

      // Extend subscription end date atomically
      const sub = await manager.findOne(Subscription, {
        where: { id: req.subscriptionId },
      });
      if (!sub) {
        throw new NotFoundException('Associated subscription not found');
      }

      const currentEnd = sub.endDate || new Date().toISOString().split('T')[0];
      sub.endDate = addDaysToDateString(currentEnd, req.breakDays);
      await manager.save(Subscription, sub);

      return savedReq;
    });
  }

  async rejectBreakRequest(
    requestId: string,
    providerUserId: string,
  ): Promise<SubscriptionBreakRequest> {
    const req = await this.breakRepo.findOne({
      where: { id: requestId },
      relations: { provider: { user: true } },
    });

    if (!req) {
      throw new NotFoundException('Subscription break request not found');
    }

    if (req.status !== SubscriptionBreakStatus.PENDING) {
      throw new BadRequestException(
        `Break request has already been ${req.status.toLowerCase()}`,
      );
    }

    if (
      req.provider.user?.id !== providerUserId &&
      req.provider.userId !== providerUserId
    ) {
      throw new ForbiddenException(
        'Cannot reject break request for another provider',
      );
    }

    req.status = SubscriptionBreakStatus.REJECTED;
    req.rejectedAt = new Date();
    req.rejectedById = providerUserId;
    return await this.breakRepo.save(req);
  }

  async updateBreakSettings(
    providerId: string,
    providerUserId: string,
    enabled: boolean,
  ): Promise<MealProvider> {
    const provider = await this.providerRepo.findOne({
      where: { id: providerId },
      relations: { user: true },
    });
    if (!provider) {
      throw new NotFoundException('Provider kitchen not found');
    }
    if (
      provider.user?.id !== providerUserId &&
      provider.userId !== providerUserId
    ) {
      throw new ForbiddenException(
        'Cannot modify settings for another provider',
      );
    }
    provider.subscriptionBreaksEnabled = enabled;
    return await this.providerRepo.save(provider);
  }
}
