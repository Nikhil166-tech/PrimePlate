import { MealRecoverySchedulerService } from './meal-recovery-scheduler.service';
import { MealRecoveryService } from './meal-recovery.service';

describe('MealRecoverySchedulerService', () => {
  let scheduler: MealRecoverySchedulerService;
  let recoveryService: Partial<MealRecoveryService>;

  beforeEach(() => {
    recoveryService = {
      processEligibleEndedSubscriptions: jest.fn().mockResolvedValue({
        inspected: 5,
        processed: 3,
        skipped: 2,
        errors: 0,
      }),
    };
    scheduler = new MealRecoverySchedulerService(
      recoveryService as MealRecoveryService,
    );
  });

  afterEach(() => {
    scheduler.onModuleDestroy();
  });

  it('triggers processing and delegates to processEligibleEndedSubscriptions', async () => {
    const res = await scheduler.triggerProcessing();
    expect(
      recoveryService.processEligibleEndedSubscriptions,
    ).toHaveBeenCalledTimes(1);
    expect(res).toEqual({
      inspected: 5,
      processed: 3,
      skipped: 2,
      errors: 0,
    });
  });

  it('cleans up timers on module destroy without throwing', () => {
    scheduler.onModuleInit();
    expect(() => scheduler.onModuleDestroy()).not.toThrow();
  });
});
