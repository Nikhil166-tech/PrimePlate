import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket } from './support-ticket.entity';
import { Payment } from '../payments/payment.entity';
import { User } from '../users/user.entity';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { EmailService } from '../common/email.service';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket, Payment, User])],
  controllers: [SupportController],
  providers: [SupportService, EmailService],
  exports: [SupportService],
})
export class SupportModule {}
