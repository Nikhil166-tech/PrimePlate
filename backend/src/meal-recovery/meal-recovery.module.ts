import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealRecovery } from './meal-recovery.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { MealUsage } from '../meal-usage/meal-usage.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { MealRecoveryService } from './meal-recovery.service';
import { MealRecoverySchedulerService } from './meal-recovery-scheduler.service';
import { MealRecoveryController } from './meal-recovery.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MealRecovery,
      MealProvider,
      MealUsage,
      Subscription,
    ]),
  ],
  controllers: [MealRecoveryController],
  providers: [MealRecoveryService, MealRecoverySchedulerService],
  exports: [MealRecoveryService, MealRecoverySchedulerService],
})
export class MealRecoveryModule {}
