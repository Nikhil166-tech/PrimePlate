import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';
import { ProviderStatus } from '../common/enums/provider-status.enum';
import { Category } from '../common/enums/category.enum';
import { ProviderApprovalStatus } from '../common/enums/provider-approval-status.enum';

@Entity({ name: 'meal_providers' })
export class MealProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.mealProviders, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ nullable: true })
  city?: string;

  @Column({ nullable: true })
  mealType?: string; // e.g., 'Veg', 'Non-Veg', etc.

  @Column({ type: 'float', nullable: true })
  distanceKm?: number;

  @Column({ type: 'float', nullable: true })
  latitude?: number;

  @Column({ type: 'float', nullable: true })
  longitude?: number;

  @Column({ type: 'float', nullable: true })
  budget?: number;

  @Column({ type: 'float', default: 2999 })
  monthlyPrice?: number;

  @Column({ type: 'float', default: 0 })
  rating?: number;

  @Column({ default: false })
  availableToday?: boolean;

  @Column({ default: false })
  verified: boolean;

  @Column({
    type: 'simple-enum',
    enum: ProviderStatus,
    default: ProviderStatus.ACTIVE,
  })
  status: ProviderStatus;

  @Column({ type: 'simple-enum', enum: Category, nullable: true })
  category?: Category;

  @Column({
    type: 'simple-enum',
    enum: ProviderApprovalStatus,
    default: ProviderApprovalStatus.PENDING,
  })
  approvalStatus: ProviderApprovalStatus;

  @Column({ nullable: true })
  openingTime?: string;

  @Column({ nullable: true })
  closingTime?: string;

  @Column({ default: true })
  acceptingSubscriptions: boolean;

  @Column({ type: 'int', default: 50 })
  totalCapacity: number;

  @Column({ type: 'simple-array', nullable: true })
  amenities?: string[];

  @Column({ nullable: true })
  contactPhone?: string;

  @Column({ default: false })
  subscriptionBreaksEnabled: boolean = false;




  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  @OneToMany(() => MealPlan, (plan) => plan.provider)
  mealPlans: MealPlan[];
}

export { MealProvider as Provider };
