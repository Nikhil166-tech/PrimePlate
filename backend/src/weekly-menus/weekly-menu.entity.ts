import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MealProvider } from '../providers/meal-provider.entity';

@Entity({ name: 'weekly_menus' })
export class WeeklyMenu {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => MealProvider, { onDelete: 'CASCADE' })
  provider: MealProvider;

  @Column({ type: 'int', default: 0 })
  dayOfWeek: number; // 0 = Monday, 1 = Tuesday ... 6 = Sunday

  @Column({ default: 'Lunch' })
  mealType: string; // 'Breakfast', 'Lunch', 'Dinner'

  @Column({ type: 'text', nullable: true })
  menuItems: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
