import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { MealPlan } from './meal-plan.entity';

@Entity({ name: 'daily_menus' })
export class DailyMenu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MealPlan, (plan) => plan.dailyMenus, { onDelete: 'CASCADE' })
  mealPlan: MealPlan;

  @Column({ type: 'date' })
  date: string; // ISO date string (YYYY-MM-DD)

  @Column({ type: 'json' })
  items: any; // flexible JSON structure for menu items

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
}
