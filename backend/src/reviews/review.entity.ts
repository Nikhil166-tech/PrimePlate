import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { MealProvider } from '../providers/meal-provider.entity';

@Entity({ name: 'reviews' })
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  student: User;

  @ManyToOne(() => MealProvider, { eager: true, onDelete: 'CASCADE' })
  provider: MealProvider;

  @Column({ type: 'int' })
  rating: number; // 1 to 5

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'text', nullable: true })
  providerReply?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
