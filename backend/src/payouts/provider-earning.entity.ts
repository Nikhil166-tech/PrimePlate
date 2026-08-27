import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Payment } from '../payments/payment.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { User } from '../users/user.entity';

export enum ProviderEarningStatus {
  PENDING = 'PENDING',
  ELIGIBLE = 'ELIGIBLE',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED',
  REVERSED = 'REVERSED',
}

@Entity({ name: 'provider_earnings' })
export class ProviderEarning {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  paymentId: string;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'paymentId' })
  payment?: Payment;

  @Column({ nullable: true })
  subscriptionId: string;

  @ManyToOne(() => Subscription, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription?: Subscription;

  @Column()
  providerId: string;

  @ManyToOne(() => MealProvider, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'providerId' })
  provider?: MealProvider;

  @Column()
  studentId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'studentId' })
  student?: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  platformFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  providerAmount: number;

  @Column({ default: ProviderEarningStatus.PENDING })
  status: string;

  @CreateDateColumn()
  earnedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
