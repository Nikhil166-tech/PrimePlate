import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Subscription } from '../subscriptions/subscription.entity';
import { User } from '../users/user.entity';
import { MealProvider } from '../providers/meal-provider.entity';

export enum SubscriptionBreakStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

@Entity({ name: 'subscription_break_requests' })
@Index(['subscriptionId', 'status'])
@Index(['providerId', 'status'])
@Index(['studentId', 'status'])
export class SubscriptionBreakRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Subscription, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;

  @Column()
  subscriptionId: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: User;

  @Column()
  studentId: string;

  @ManyToOne(() => MealProvider, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'providerId' })
  provider: MealProvider;

  @Column()
  providerId: string;

  @Column({ type: 'date' })
  fromDate: string;

  @Column({ type: 'date' })
  toDate: string;

  @Column({ type: 'int' })
  breakDays: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({
    type: 'simple-enum',
    enum: SubscriptionBreakStatus,
    default: SubscriptionBreakStatus.PENDING,
  })
  status: SubscriptionBreakStatus;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ nullable: true })
  approvedAt?: Date;

  @Column({ nullable: true })
  rejectedAt?: Date;

  @Column({ nullable: true })
  approvedById?: string;

  @Column({ nullable: true })
  rejectedById?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
}
