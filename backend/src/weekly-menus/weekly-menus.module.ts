import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklyMenu } from './weekly-menu.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { WeeklyMenusService } from './weekly-menus.service';
import { WeeklyMenusController } from './weekly-menus.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WeeklyMenu, MealProvider])],
  providers: [WeeklyMenusService],
  controllers: [WeeklyMenusController],
  exports: [WeeklyMenusService],
})
export class WeeklyMenusModule {}
