import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Payment } from '../payments/payment.entity';

export enum SupportTicketIssueType {
  MONEY_DEBITED_PAYMENT_FAILED = 'MONEY_DEBITED_PAYMENT_FAILED',
  PAYMENT_SUCCESSFUL_SUBSCRIPTION_MISSING = 'PAYMENT_SUCCESSFUL_SUBSCRIPTION_MISSING',
  PAYMENT_SUCCESSFUL_MESSCARD_MISSING = 'PAYMENT_SUCCESSFUL_MESSCARD_MISSING',
  PAYMENT_STUCK_PENDING = 'PAYMENT_STUCK_PENDING',
  REFUND_ISSUE = 'REFUND_ISSUE',
  OTHER = 'OTHER',
}

export enum SupportTicketStatus {
  OPEN = 'OPEN',
  INVESTIGATING = 'INVESTIGATING',
  WAITING_FOR_BANK = 'WAITING_FOR_BANK',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

@Entity({ name: 'support_tickets' })
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  ticketNumber: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  student: User;

  @ManyToOne(() => Payment, { nullable: true, onDelete: 'SET NULL' })
  payment?: Payment;

  @Index()
  @Column()
  razorpayOrderId: string;

  @Column({ nullable: true })
  razorpayPaymentId?: string;

  @Column({
    type: 'varchar',
    default: SupportTicketIssueType.OTHER,
  })
  issueType: SupportTicketIssueType;

  @Column('text')
  description: string;

  @Column({ nullable: true })
  utrReference?: string;

  @Column({
    type: 'varchar',
    default: SupportTicketStatus.OPEN,
  })
  status: SupportTicketStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
