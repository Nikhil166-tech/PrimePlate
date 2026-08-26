import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionBreakRequest } from './subscription-break-request.entity';
import { SubscriptionBreaksService } from './subscription-breaks.service';
import { SubscriptionBreaksController } from './subscription-breaks.controller';
import { Subscription } from '../subscriptions/subscription.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionBreakRequest,
      Subscription,
      MealProvider,
      User,
    ]),
  ],
  providers: [SubscriptionBreaksService],
  controllers: [SubscriptionBreaksController],
  exports: [SubscriptionBreaksService],
})
export class SubscriptionBreaksModule {}
