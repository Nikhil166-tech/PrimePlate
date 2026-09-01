import {
  IsString,
  IsOptional,
  IsUrl,
  IsEnum,
  IsNumber,
  Min,
  Max,
  MaxLength,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { Category } from '../../common/enums/category.enum';

export class ProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Description cannot exceed 1000 characters' })
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @IsOptional()
  @IsArray({ message: 'Amenities must be an array of strings' })
  @IsString({ each: true, message: 'Each amenity must be a string' })
  @ArrayMaxSize(30, { message: 'Cannot specify more than 30 amenities' })
  amenities?: string[];

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Total capacity must be a number' })
  @Min(1, { message: 'Total capacity must be at least 1' })
  totalCapacity?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Monthly price must be a valid number' })
  @Min(1, { message: 'Monthly price must be greater than 0' })
  monthlyPrice?: number;

  @IsOptional()
  acceptingSubscriptions?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  subscriptionBreaksEnabled?: boolean;
}
