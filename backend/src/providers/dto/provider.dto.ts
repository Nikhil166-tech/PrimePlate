import { IsString, IsOptional, IsUrl, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Category } from '../../common/enums/category.enum';

export class ProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
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
  amenities?: string[];

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  totalCapacity?: number;

  @IsOptional()
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
}
