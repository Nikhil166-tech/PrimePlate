import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { SupportTicketIssueType } from '../support-ticket.entity';

export class CreateSupportTicketDto {
  @IsString()
  @IsNotEmpty()
  razorpayOrderId: string;

  @IsEnum(SupportTicketIssueType)
  @IsNotEmpty()
  issueType: SupportTicketIssueType;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  utrReference?: string;
}
