import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsPositive,
} from 'class-validator';

export class UpdateMealPlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

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
  @IsBoolean()
  isActive?: boolean;
}
