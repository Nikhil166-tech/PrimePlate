import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { MealRecoveryService } from './meal-recovery.service';

@Injectable()
export class MealRecoverySchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MealRecoverySchedulerService.name);
  private intervalTimer: NodeJS.Timeout | null = null;
  private initialTimer: NodeJS.Timeout | null = null;

  // Run approximately every 15 minutes (15 * 60 * 1000 ms)
  private readonly intervalMs = 15 * 60 * 1000;

  constructor(private readonly mealRecoveryService: MealRecoveryService) {}

  onModuleInit() {
    // Avoid background timers during automated unit/integration tests
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    this.logger.log(
      'Initializing MealRecoverySchedulerService — running automatic recovery engine',
    );

    // Initial run shortly after startup (5 seconds) to allow DB connections to settle
    this.initialTimer = setTimeout(() => {
      this.triggerProcessing().catch((err) => {
        this.logger.error(
          `Initial recovery processing error: ${err?.message || err}`,
        );
      });
    }, 5000);

    // Periodic schedule
    this.intervalTimer = setInterval(() => {
      this.triggerProcessing().catch((err) => {
        this.logger.error(
          `Scheduled recovery processing error: ${err?.message || err}`,
        );
      });
    }, this.intervalMs);

    // Ensure timers do not block clean process exit
    if (this.initialTimer?.unref) {
      this.initialTimer.unref();
    }
    if (this.intervalTimer?.unref) {
      this.intervalTimer.unref();
    }
  }

  onModuleDestroy() {
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.logger.log('MealRecoverySchedulerService destroyed and timers cleared');
  }

  /**
   * Invokes the automatic batch processor safely.
   */
  async triggerProcessing(): Promise<{
    inspected: number;
    processed: number;
    skipped: number;
    errors: number;
  }> {
    return this.mealRecoveryService.processEligibleEndedSubscriptions();
  }
}
