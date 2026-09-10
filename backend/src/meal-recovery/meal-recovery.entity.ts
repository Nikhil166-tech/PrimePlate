import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  Unique,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum MealRecoveryStatus {
  AVAILABLE = 'AVAILABLE',
  PARTIALLY_USED = 'PARTIALLY_USED',
  USED = 'USED',
}

/**
 * Records a single recovery event for one subscription.
 * UNIQUE on sourceSubscriptionId prevents duplicate recovery for the same subscription.
 * Recovery is provider-specific: a student's balance at Provider A cannot be used at Provider B.
 */
@Entity({ name: 'meal_recoveries' })
@Unique('UQ_meal_recoveries_source_subscription', ['sourceSubscriptionId'])
@Index('IDX_meal_recoveries_student_provider', ['studentId', 'providerId'])
@Index('IDX_meal_recoveries_provider_status', ['providerId', 'status'])
export class MealRecovery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  studentId: string;

  @Column({ type: 'varchar' })
  providerId: string;

  /** The subscription whose missed meals generated this recovery. One recovery per subscription. */
  @Column({ type: 'varchar' })
  sourceSubscriptionId: string;

  /** Total eligible missed days identified in this subscription's period. */
  @Column({ type: 'int' })
  missedDays: number;

  /**
   * Snapshotted recovery percentage at the time of processing.
   * Provider changing their percentage later does NOT alter this value.
   */
  @Column({ type: 'int' })
  recoveryRate: number;

  /** floor(missedDays * recoveryRate / 100) */
  @Column({ type: 'int' })
  recoveredDays: number;

  /** How many of the recovered days have been consumed by subsequent subscriptions. */
  @Column({ type: 'int', default: 0 })
  usedDays: number;

  /** recoveredDays - usedDays. Updated on each consumption. */
  @Column({ type: 'int' })
  remainingDays: number;

  @Column({ type: 'varchar', default: MealRecoveryStatus.AVAILABLE })
  status: string;

  /** Timestamp when recovery was calculated and committed. */
  @Column({ type: 'timestamp with time zone', nullable: true })
  processedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
