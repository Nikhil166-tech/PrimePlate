import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { MealProvider } from '../providers/meal-provider.entity';
import { DailyMenu } from './daily-menu.entity';

@Entity({ name: 'meal_plans' })
export class MealPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MealProvider, (provider) => provider.mealPlans, {
    eager: true,
  })
  provider: MealProvider;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerMonth: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  originalPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  sellingPrice: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  @OneToMany(() => DailyMenu, (menu) => menu.mealPlan)
  dailyMenus: DailyMenu[];
}
