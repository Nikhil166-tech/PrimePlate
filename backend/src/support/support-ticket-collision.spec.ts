import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SupportService } from './support.service';
import { SupportTicket, SupportTicketStatus, SupportTicketIssueType } from './support-ticket.entity';
import { Payment } from '../payments/payment.entity';
import { User } from '../users/user.entity';
import { ConflictException } from '@nestjs/common';

describe('SupportService — Collision-Resistant Ticket Number Generation & Safe Retry', () => {
  let service: SupportService;
  let ticketRepo: any;
  let paymentRepo: any;
  let userRepo: any;

  const studentId = 'student-uuid-test';
  const orderId = 'order_12345678';

  beforeEach(async () => {
    ticketRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn(),
    };

    paymentRepo = {
      findOne: jest.fn(),
    };

    userRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: getRepositoryToken(SupportTicket), useValue: ticketRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<SupportService>(SupportService);
  });

  const dto = {
    razorpayOrderId: orderId,
    issueType: SupportTicketIssueType.MONEY_DEBITED_NOT_CREDITED,
    description: 'Amount deducted from UPI but plan not active',
  };

  it('1. SHOULD generate collision-resistant ticket number with date prefix and 6-char hex suffix', async () => {
    userRepo.findOne.mockResolvedValue({ id: studentId, name: 'Alice' });
    paymentRepo.findOne.mockResolvedValue({
      id: 'pay-1',
      razorpayOrderId: orderId,
      student: { id: studentId },
    });
    ticketRepo.findOne.mockResolvedValue(null); // No existing active ticket
    ticketRepo.save.mockImplementation(async (ticket: any) => ({
      id: 'ticket-1',
      ...ticket,
    }));

    const ticket = await service.createPaymentIssueTicket(studentId, dto);

    // Format: TK-YYYYMMDD-XXXXXX (6 hex chars uppercase)
    expect(ticket.ticketNumber).toMatch(/^TK-\d{8}-[0-9A-F]{6}$/);
    expect(ticket.status).toBe(SupportTicketStatus.OPEN);
  });

  it('2. SHOULD retry on unique constraint collision and succeed on subsequent attempt', async () => {
    userRepo.findOne.mockResolvedValue({ id: studentId, name: 'Alice' });
    paymentRepo.findOne.mockResolvedValue({
      id: 'pay-1',
      razorpayOrderId: orderId,
      student: { id: studentId },
    });
    ticketRepo.findOne.mockResolvedValue(null);

    let callCount = 0;
    ticketRepo.save.mockImplementation(async (ticket: any) => {
      callCount++;
      if (callCount === 1) {
        const err: any = new Error('duplicate key value violates unique constraint "UQ_support_tickets_ticket_number"');
        err.code = '23505';
        throw err;
      }
      return { id: 'ticket-saved', ...ticket };
    });

    const ticket = await service.createPaymentIssueTicket(studentId, dto);

    expect(callCount).toBe(2);
    expect(ticket.ticketNumber).toMatch(/^TK-\d{8}-[0-9A-F]{6}$/);
    expect(ticket.id).toBe('ticket-saved');
  });

  it('3. SHOULD throw ConflictException if all retry attempts collide', async () => {
    userRepo.findOne.mockResolvedValue({ id: studentId, name: 'Alice' });
    paymentRepo.findOne.mockResolvedValue({
      id: 'pay-1',
      razorpayOrderId: orderId,
      student: { id: studentId },
    });
    ticketRepo.findOne.mockResolvedValue(null);

    ticketRepo.save.mockImplementation(async () => {
      const err: any = new Error('UNIQUE constraint failed: support_tickets.ticketNumber');
      err.code = '23505';
      throw err;
    });

    await expect(
      service.createPaymentIssueTicket(studentId, dto),
    ).rejects.toThrow(ConflictException);
  });
});
