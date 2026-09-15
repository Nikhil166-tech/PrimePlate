import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MarkPaidDto {
  @ApiPropertyOptional({
    description:
      'Internal settlement reference or external transaction/UTR reference (e.g. UPI-123456789012 or PRIMEPLATE-SETTLE-...)',
    example: 'PRIMEPLATE-SETTLE-20260915-001',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  settlementReference?: string;
}
