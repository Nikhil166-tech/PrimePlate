import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './payment.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';
import { User } from '../users/user.entity';
import { ProviderEarning } from '../payouts/provider-earning.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PayoutsModule } from '../payouts/payouts.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, MealPlan, User, ProviderEarning]),
    SubscriptionsModule,
    PayoutsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
