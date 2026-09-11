import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, In } from 'typeorm';
import { MealRecovery, MealRecoveryStatus } from './meal-recovery.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { MealUsage } from '../meal-usage/meal-usage.entity';
import { Subscription } from '../subscriptions/subscription.entity';

@Injectable()
export class MealRecoveryService {
  private readonly logger = new Logger(MealRecoveryService.name);

  constructor(
    @InjectRepository(MealRecovery)
    private readonly recoveryRepo: Repository<MealRecovery>,
    @InjectRepository(MealProvider)
    private readonly providerRepo: Repository<MealProvider>,
    @InjectRepository(MealUsage)
    private readonly usageRepo: Repository<MealUsage>,
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
  ) {}

  /**
   * Returns today's date in IST as YYYY-MM-DD (authoritative local date).
   */
  private getIstToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  /**
   * Resolves and verifies that userId owns the given provider.
   * If providerId is not supplied, picks the first provider owned by userId.
   */
  private async resolveProvider(
    userId: string,
    providerId?: string,
  ): Promise<MealProvider> {
    const where: any = providerId
      ? [{ id: providerId, userId }, { id: providerId, user: { id: userId } }]
      : [{ userId }, { user: { id: userId } }];
    const provider = await this.providerRepo.findOne({
      where,
      relations: { user: true },
    });
    if (!provider) {
      throw new NotFoundException('Provider kitchen not found or access denied');
    }
    if (provider.user?.id !== userId && provider.userId !== userId) {
      throw new ForbiddenException(
        'You do not own this provider kitchen',
      );
    }
    return provider;
  }

  /**
   * Idempotent: Process recovery for a subscription.
   * - Reads provider's CURRENT recoveryPercentage (snapshotted into recoveryRate).
   * - Counts eligible missed days (past, within subscription, no check-in).
   * - Creates exactly one MealRecovery record. Safe to retry.
   * - If recoveredDays == 0, no record is created (avoids zero-balance noise).
   */
  async processSubscriptionRecovery(
    subscriptionId: string,
    userId?: string,
    providerId?: string,
  ): Promise<{
    processed: boolean;
    alreadyProcessed: boolean;
    subscriptionId: string;
    missedDays: number;
    recoveryRate: number;
    recoveredDays: number;
    recovery: MealRecovery | null;
  }> {
    // 1. Load the subscription with relations
    const sub = await this.subRepo.findOne({
      where: { id: subscriptionId },
      relations: { student: true, mealPlan: { provider: true } },
    });
    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }

    // 2. Verify provider relationship
    const provider = sub.mealPlan?.provider;
    if (!provider) {
      throw new NotFoundException('Subscription has no associated provider');
    }
    if (userId) {
      if (provider.user?.id !== userId && provider.userId !== userId) {
        // Double check via resolveProvider for full ownership validation
        await this.resolveProvider(userId, provider.id);
      }
      if (providerId && providerId !== provider.id) {
        throw new ForbiddenException(
          'Subscription does not belong to the specified provider',
        );
      }
    }

    // 3. Idempotency: Check if already processed
    const existing = await this.recoveryRepo.findOne({
      where: { sourceSubscriptionId: subscriptionId },
    });
    if (existing) {
      this.logger.log(
        `Recovery already processed for subscription ${subscriptionId} — returning existing record`,
      );
      return {
        processed: false,
        alreadyProcessed: true,
        subscriptionId,
        missedDays: existing.missedDays,
        recoveryRate: existing.recoveryRate,
        recoveredDays: existing.recoveredDays,
        recovery: existing,
      };
    }

    // 4. Determine eligible missed days
    const todayIst = this.getIstToday();
    const startDateStr = sub.startDate || todayIst;
    let endDateStr = sub.endDate;
    if (!endDateStr) {
      const s = new Date(startDateStr + 'T00:00:00Z');
      s.setDate(s.getDate() + 30);
      endDateStr = s.toISOString().split('T')[0];
    }

    // Build set of dates: startDate <= date < todayIst AND date <= endDate
    // (Final day only eligible after it has ended, so strictly < todayIst)
    const eligibleDates: string[] = [];
    const cur = new Date(startDateStr + 'T00:00:00Z');
    const end = new Date(endDateStr + 'T00:00:00Z');

    let safetyCount = 0;
    while (cur <= end && safetyCount < 400) {
      const dateStr = cur.toISOString().split('T')[0];
      // Strictly less-than today: the day must have already ENDED
      if (dateStr < todayIst) {
        eligibleDates.push(dateStr);
      }
      cur.setDate(cur.getDate() + 1);
      safetyCount++;
    }

    if (eligibleDates.length === 0) {
      return {
        processed: false,
        alreadyProcessed: false,
        subscriptionId,
        missedDays: 0,
        recoveryRate: provider.recoveryPercentage ?? 80,
        recoveredDays: 0,
        recovery: null,
      };
    }

    // 5. Query existing check-ins for this subscription
    const usages = await this.usageRepo.find({
      where: { subscriptionId: sub.id },
      select: { mealDate: true },
    });
    const checkedInDates = new Set(usages.map((u) => u.mealDate));

    // Also check by student+provider as a fallback (matches MealUsageService pattern)
    if (sub.student?.id) {
      const fallbackUsages = await this.usageRepo.find({
        where: { studentId: sub.student.id, providerId: provider.id },
        select: { mealDate: true },
      });
      fallbackUsages.forEach((u) => checkedInDates.add(u.mealDate));
    }

    // 6. Count missed eligible days
    let missedDays = 0;
    for (const date of eligibleDates) {
      if (!checkedInDates.has(date)) {
        missedDays++;
      }
    }

    // 7. Read current provider recovery percentage (snapshot it)
    const recoveryRate = provider.recoveryPercentage ?? 80;

    // 8. Calculate recovered days using floor()
    const recoveredDays = Math.floor((missedDays * recoveryRate) / 100);

    // 9. Do not create a useless zero-balance record
    if (recoveredDays === 0) {
      this.logger.log(
        `Subscription ${subscriptionId}: missedDays=${missedDays} @ ${recoveryRate}% = 0 recovered days — no record created`,
      );
      return {
        processed: false,
        alreadyProcessed: false,
        subscriptionId,
        missedDays,
        recoveryRate,
        recoveredDays: 0,
        recovery: null,
      };
    }

    // 10. Create the recovery record. Unique constraint on sourceSubscriptionId handles race conditions.
    try {
      const recovery = this.recoveryRepo.create({
        studentId: sub.student.id,
        providerId: provider.id,
        sourceSubscriptionId: subscriptionId,
        missedDays,
        recoveryRate,
        recoveredDays,
        usedDays: 0,
        remainingDays: recoveredDays,
        status: MealRecoveryStatus.AVAILABLE,
        processedAt: new Date(),
      });
      const saved = await this.recoveryRepo.save(recovery);

      this.logger.log(
        `Recovery processed: subscriptionId=${subscriptionId}, missed=${missedDays}, rate=${recoveryRate}%, recovered=${recoveredDays}`,
      );
      return {
        processed: true,
        alreadyProcessed: false,
        subscriptionId,
        missedDays,
        recoveryRate,
        recoveredDays,
        recovery: saved,
      };
    } catch (err: any) {
      // Unique constraint violation = race condition, return existing
      if (
        err?.code === '23505' ||
        (err?.message || '').includes('duplicate') ||
        (err?.message || '').includes('unique constraint')
      ) {
        const raced = await this.recoveryRepo.findOne({
          where: { sourceSubscriptionId: subscriptionId },
        });
        return {
          processed: false,
          alreadyProcessed: true,
          subscriptionId,
          missedDays: raced?.missedDays ?? missedDays,
          recoveryRate: raced?.recoveryRate ?? recoveryRate,
          recoveredDays: raced?.recoveredDays ?? recoveredDays,
          recovery: raced ?? null,
        };
      }
      throw err;
    }
  }

  /**
   * Automatic background processor: Finds all ended subscriptions whose recovery
   * has not yet been processed (endDate < todayIst).
   *
   * Idempotency guarantee: Protected by both query filtering and the database
   * unique constraint on sourceSubscriptionId (UQ_meal_recoveries_source_subscription).
   * Safe for multiple concurrent runs.
   */
  async processEligibleEndedSubscriptions(): Promise<{
    inspected: number;
    processed: number;
    skipped: number;
    errors: number;
  }> {
    const todayIst = this.getIstToday();
    this.logger.log(
      `[Automatic Recovery] Processing eligible subscriptions ended before ${todayIst}`,
    );

    // Find subscriptions where endDate < todayIst and no recovery row exists yet
    const candidates = await this.subRepo
      .createQueryBuilder('sub')
      .leftJoin(
        MealRecovery,
        'mr',
        'CAST(mr.sourceSubscriptionId AS text) = CAST(sub.id AS text)',
      )
      .leftJoinAndSelect('sub.mealPlan', 'plan')
      .leftJoinAndSelect('plan.provider', 'provider')
      .leftJoinAndSelect('sub.student', 'student')
      .where('sub.endDate IS NOT NULL')
      .andWhere('sub.endDate < :todayIst', { todayIst })
      .andWhere('mr.id IS NULL')
      .take(100)
      .getMany();

    const inspected = candidates.length;
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    for (const sub of candidates) {
      try {
        const res = await this.processSubscriptionRecovery(sub.id);
        if (res.processed) {
          processed++;
        } else {
          skipped++;
        }
      } catch (err: any) {
        errors++;
        this.logger.error(
          `[Automatic Recovery] Error processing subscription ${sub.id}: ${err?.message || err}`,
        );
      }
    }

    this.logger.log(
      `[Automatic Recovery] Completed: inspected=${inspected}, processed=${processed}, skipped=${skipped}, errors=${errors}`,
    );

    return { inspected, processed, skipped, errors };
  }

  /**
   * Returns provider-specific recovery balances for a student.
   * Each entry contains the providerId, provider name, and total remaining days.
   * Never returns one combined number across providers.
   */
  async getStudentRecoveryBalance(
    studentId: string,
    providerId?: string,
  ): Promise<
    Array<{
      providerId: string;
      providerName: string;
      remainingDays: number;
      totalRecoveredDays: number;
      usedDays: number;
      records: MealRecovery[];
    }>
  > {
    const where: any = {
      studentId,
      status: In([MealRecoveryStatus.AVAILABLE, MealRecoveryStatus.PARTIALLY_USED]),
    };
    if (providerId) {
      where.providerId = providerId;
    }

    const records = await this.recoveryRepo.find({
      where,
      order: { createdAt: 'ASC' },
    });

    // Group by providerId
    const map = new Map<string, MealRecovery[]>();
    for (const r of records) {
      const list = map.get(r.providerId) ?? [];
      list.push(r);
      map.set(r.providerId, list);
    }

    const providerIds = [...map.keys()];
    if (providerIds.length === 0) return [];

    const providers = await this.providerRepo.find({
      where: providerIds.map((id) => ({ id })),
      select: { id: true, name: true },
    });
    const providerNameMap = new Map(providers.map((p) => [p.id, p.name]));

    return providerIds.map((pId) => {
      const list = map.get(pId)!;
      const remainingDays = list.reduce((s, r) => s + r.remainingDays, 0);
      const totalRecoveredDays = list.reduce((s, r) => s + r.recoveredDays, 0);
      const usedDays = list.reduce((s, r) => s + r.usedDays, 0);
      return {
        providerId: pId,
        providerName: providerNameMap.get(pId) ?? 'Unknown Provider',
        remainingDays,
        totalRecoveredDays,
        usedDays,
        records: list,
      };
    });
  }

  /**
   * Consume recovery days for a student at a specific provider.
   * MUST run inside an existing database transaction (manager param).
   * Returns the number of days actually consumed.
   * Never produces a negative remainingDays.
   * Supports both (studentId, providerId, daysToConsume?, manager)
   * and (studentId, providerId, manager, daysToConsume?).
   */
  async consumeRecovery(
    studentId: string,
    providerId: string,
    daysToConsumeOrManager: number | EntityManager,
    managerOrNull?: EntityManager | number,
  ): Promise<number> {
    let daysToConsume: number | undefined;
    let manager: EntityManager;

    if (typeof daysToConsumeOrManager === 'number') {
      daysToConsume = daysToConsumeOrManager;
      manager = managerOrNull as EntityManager;
    } else {
      manager = daysToConsumeOrManager;
      daysToConsume = typeof managerOrNull === 'number' ? managerOrNull : undefined;
    }

    if (!manager) {
      throw new Error('EntityManager is required for transactional recovery consumption');
    }

    // Fetch all available/partially-used records for this student+provider (FIFO)
    const records = await manager.find(MealRecovery, {
      where: {
        studentId,
        providerId,
        status: In([MealRecoveryStatus.AVAILABLE, MealRecoveryStatus.PARTIALLY_USED]),
      },
      order: { createdAt: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });

    if (records.length === 0) return 0;

    const totalAvailable = records.reduce((s, r) => s + r.remainingDays, 0);
    if (totalAvailable <= 0) return 0;

    // Consume up to requested daysToConsume, or all available if omitted / non-positive
    let toConsume = (daysToConsume !== undefined && daysToConsume > 0)
      ? Math.min(totalAvailable, daysToConsume)
      : totalAvailable;

    let actuallyConsumed = 0;

    for (const record of records) {
      if (toConsume <= 0) break;
      if (record.remainingDays <= 0) continue;

      const take = Math.min(record.remainingDays, toConsume);
      record.usedDays += take;
      record.remainingDays -= take;
      actuallyConsumed += take;
      toConsume -= take;

      // Update status
      if (record.remainingDays === 0) {
        record.status = MealRecoveryStatus.USED;
      } else {
        record.status = MealRecoveryStatus.PARTIALLY_USED;
      }

      await manager.save(MealRecovery, record);
    }

    this.logger.log(
      `Recovery consumed: studentId=${studentId}, providerId=${providerId}, consumed=${actuallyConsumed}`,
    );
    return actuallyConsumed;
  }

  /**
   * Provider recovery statistics — real data, no mocks.
   * Ownership validated from authenticated userId.
   */
  async getProviderRecoveryStats(
    userId: string,
    providerId?: string,
  ): Promise<{
    providerId: string;
    providerName: string;
    recoveryPercentage: number;
    missedMealDays: number;
    recoveryDaysGranted: number;
    recoveryDaysUsed: number;
    recoveryDaysRemaining: number;
    totalRecords: number;
  }> {
    const provider = await this.resolveProvider(userId, providerId);

    const records = await this.recoveryRepo.find({
      where: { providerId: provider.id },
    });

    const missedMealDays = records.reduce((s, r) => s + r.missedDays, 0);
    const recoveryDaysGranted = records.reduce((s, r) => s + r.recoveredDays, 0);
    const recoveryDaysUsed = records.reduce((s, r) => s + r.usedDays, 0);
    const recoveryDaysRemaining = records.reduce((s, r) => s + r.remainingDays, 0);

    return {
      providerId: provider.id,
      providerName: provider.name,
      recoveryPercentage: provider.recoveryPercentage ?? 80,
      missedMealDays,
      recoveryDaysGranted,
      recoveryDaysUsed,
      recoveryDaysRemaining,
      totalRecords: records.length,
    };
  }

  /**
   * Provider audit: full list of recovery records for their subscribers.
   * Includes student info, source subscription, missed days, rate, balances.
   */
  async getProviderRecoveryAudit(
    userId: string,
    providerId?: string,
  ): Promise<MealRecovery[]> {
    const provider = await this.resolveProvider(userId, providerId);

    return this.recoveryRepo.find({
      where: { providerId: provider.id },
      order: { processedAt: 'DESC', createdAt: 'DESC' },
    });
  }
}
