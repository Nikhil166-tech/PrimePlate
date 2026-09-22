import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsPositive,
  IsEnum,
} from 'class-validator';
import { MealType } from '../meal-plan.entity';

export class UpdateMealPlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsEnum(MealType)
  mealType?: MealType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  originalPrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  sellingPrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  pricePerMonth?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  customOneDayPrice?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
