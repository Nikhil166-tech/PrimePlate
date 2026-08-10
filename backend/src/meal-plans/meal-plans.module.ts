import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealPlan } from './meal-plan.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { DailyMenu } from './daily-menu.entity';
import { MealPlansService } from './meal-plans.service';
import { MealPlansController } from './meal-plans.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MealPlan, MealProvider, DailyMenu])],
  providers: [MealPlansService],
  controllers: [MealPlansController],
  exports: [MealPlansService],
})
export class MealPlansModule {}
