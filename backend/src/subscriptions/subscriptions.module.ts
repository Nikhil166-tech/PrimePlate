import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './subscription.entity';
import { User } from '../users/user.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, User, MealPlan]),
    forwardRef(() => PaymentsModule),
  ],
  providers: [SubscriptionsService],
  controllers: [SubscriptionsController],
  exports: [SubscriptionsService, TypeOrmModule],
})
export class SubscriptionsModule {}
