import { IsNotEmpty, IsString, IsOptional, Matches } from 'class-validator';

export class CreateBreakRequestDto {
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'fromDate must be in YYYY-MM-DD format',
  })
  fromDate: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'toDate must be in YYYY-MM-DD format',
  })
  toDate: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
