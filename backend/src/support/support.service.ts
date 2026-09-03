import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  SupportTicket,
  SupportTicketIssueType,
  SupportTicketStatus,
} from './support-ticket.entity';
import { Payment } from '../payments/payment.entity';
import { User } from '../users/user.entity';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';

import { Optional } from '@nestjs/common';
import { EmailService } from '../common/email.service';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Optional()
    private readonly emailService?: EmailService,
  ) {}

  async createPaymentIssueTicket(
    userId: string,
    dto: CreateSupportTicketDto,
  ): Promise<SupportTicket> {
    const student = await this.userRepo.findOne({ where: { id: userId } });
    if (!student) {
      throw new NotFoundException('Authenticated user profile not found');
    }

    const payment = await this.paymentRepo.findOne({
      where: { razorpayOrderId: dto.razorpayOrderId },
      relations: { student: true },
    });

    if (!payment) {
      throw new BadRequestException(
        `No payment record found for order ID "${dto.razorpayOrderId}"`,
      );
    }

    // IDOR Check: Ensure payment belongs to authenticated student
    if (payment.student && payment.student.id !== userId) {
      this.logger.warn(
        `IDOR_PREVENTED: Student ${userId} attempted to raise ticket for order ${dto.razorpayOrderId} owned by ${payment.student.id}`,
      );
      throw new ForbiddenException(
        'You can only report payment issues for your own payment orders.',
      );
    }

    // UTR Format Validation if provided
    if (dto.utrReference) {
      const cleanUtr = dto.utrReference.trim();
      if (cleanUtr.length < 4 || cleanUtr.length > 50 || !/^[a-zA-Z0-9_-]+$/.test(cleanUtr)) {
        throw new BadRequestException(
          'Invalid UTR / Bank Reference format. Must be 4-50 alphanumeric characters.',
        );
      }
    }

    // Duplicate Ticket Protection: Check if active ticket already exists for order
    const existingTicket = await this.ticketRepo.findOne({
      where: {
        student: { id: userId },
        razorpayOrderId: dto.razorpayOrderId,
        status: In([
          SupportTicketStatus.OPEN,
          SupportTicketStatus.INVESTIGATING,
          SupportTicketStatus.WAITING_FOR_BANK,
        ]),
      },
    });

    if (existingTicket) {
      throw new ConflictException(
        `A support ticket (#${existingTicket.ticketNumber}) has already been raised for this payment order. Status: ${existingTicket.status}`,
      );
    }

    // Generate Server-Side Ticket Number (NEVER client-side Math.random()!)
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `TK-${datePrefix}-${randomSuffix}`;

    const ticket = this.ticketRepo.create({
      ticketNumber,
      student,
      payment,
      razorpayOrderId: dto.razorpayOrderId,
      razorpayPaymentId: payment.razorpayPaymentId || undefined,
      issueType: dto.issueType,
      description: dto.description.trim(),
      utrReference: dto.utrReference ? dto.utrReference.trim() : undefined,
      status: SupportTicketStatus.OPEN,
    });

    const saved = await this.ticketRepo.save(ticket);
    this.logger.log(
      `SUPPORT_TICKET_CREATED: ticketNumber=${saved.ticketNumber}, orderId=${saved.razorpayOrderId}, studentId=${userId}`,
    );

    // Dispatch email notification asynchronously
    if (this.emailService) {
      this.emailService
        .sendSupportTicketEmail({
          ticketNumber: saved.ticketNumber,
          studentName: student.name || 'PrimeMate Student',
          studentEmail: student.email,
          razorpayOrderId: saved.razorpayOrderId,
          amount: Number(payment.amount),
          issueType: saved.issueType,
          description: saved.description,
          utrReference: saved.utrReference || undefined,
        })
        .catch((err) => {
          this.logger.error(`Failed to send support ticket email: ${err.message}`);
        });
    }

    return saved;
  }

  async getTicketsForUser(userId: string): Promise<SupportTicket[]> {
    return this.ticketRepo.find({
      where: { student: { id: userId } },
      order: { createdAt: 'DESC' },
    });
  }

  async getTicketByOrderId(userId: string, orderId: string): Promise<SupportTicket | null> {
    return this.ticketRepo.findOne({
      where: {
        student: { id: userId },
        razorpayOrderId: orderId,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getTicketById(userId: string, ticketId: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: { student: true, payment: true },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    if (ticket.student && ticket.student.id !== userId) {
      throw new ForbiddenException('You do not have permission to view this ticket.');
    }

    return ticket;
  }
}
