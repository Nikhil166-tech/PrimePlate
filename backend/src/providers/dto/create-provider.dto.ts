import { IsString, IsOptional, IsUrl } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsUrl()
  imageUrl?: string; // client can send Cloudinary URL after upload
}
