import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealUsage } from './meal-usage.entity';
import { MealUsageAudit } from './meal-usage-audit.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { User } from '../users/user.entity';
import { MealUsageService } from './meal-usage.service';
import { MealUsageController } from './meal-usage.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MealUsage,
      MealUsageAudit,
      MealProvider,
      Subscription,
      User,
    ]),
  ],
  controllers: [MealUsageController],
  providers: [MealUsageService],
  exports: [MealUsageService],
})
export class MealUsageModule {}
