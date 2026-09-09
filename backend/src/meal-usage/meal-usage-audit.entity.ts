import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'meal_usage_audits' })
@Index('IDX_meal_usage_audits_provider', ['providerId'])
@Index('IDX_meal_usage_audits_student', ['studentId'])
export class MealUsageAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  mealUsageId: string;

  @Column()
  providerId: string;

  @Column()
  actorId: string; // The authenticated provider user who performed the action

  @Column()
  subscriptionId: string;

  @Column()
  studentId: string;

  @Column()
  action: string; // e.g., 'MANUAL_CORRECTION'

  @Column({ type: 'text' })
  reason: string; // Required justification for the correction

  @CreateDateColumn()
  createdAt: Date;
}
