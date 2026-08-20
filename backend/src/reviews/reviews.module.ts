import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review } from './review.entity';
import { User } from '../users/user.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Review, User, MealProvider, Subscription]),
  ],
  providers: [ReviewsService],
  controllers: [ReviewsController],
  exports: [ReviewsService, TypeOrmModule],
})
export class ReviewsModule {}
