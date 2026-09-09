import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { MealProvider } from '../providers/meal-provider.entity';

export enum MealUsageStatus {
  USED = 'USED',
}

export enum MealUsageSource {
  QR_SCAN = 'QR_SCAN',
  PROVIDER_CORRECTION = 'PROVIDER_CORRECTION',
}

@Entity({ name: 'meal_usages' })
@Unique('UQ_meal_usages_student_date', ['studentId', 'mealDate'])
@Index('IDX_meal_usages_provider_date', ['providerId', 'mealDate'])
@Index('IDX_meal_usages_student_sub', ['studentId', 'subscriptionId'])
export class MealUsage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'studentId' })
  student: User;

  @Column()
  studentId: string;

  @ManyToOne(() => Subscription, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription;

  @Column()
  subscriptionId: string;

  @ManyToOne(() => MealProvider, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'providerId' })
  provider: MealProvider;

  @Column()
  providerId: string;

  @Column({ type: 'date' })
  mealDate: string; // ISO date format 'YYYY-MM-DD' in IST

  @Column({
    type: 'varchar',
    default: MealUsageStatus.USED,
  })
  status: string;

  @Column({
    type: 'varchar',
    default: MealUsageSource.QR_SCAN,
  })
  source: string;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  scannedAt: Date;

  @Column({ nullable: true })
  correctedAt?: Date;

  @Column({ nullable: true })
  correctedBy?: string; // Provider user ID who authorized correction

  @Column({ type: 'text', nullable: true })
  correctionReason?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
