import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
} from 'typeorm';
import { MealProvider } from '../providers/meal-provider.entity';
import { Role } from '../common/roles.enum';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  area?: string;

  @Column({ nullable: true })
  foodPreference?: string;

  @Column({ type: 'float', nullable: true })
  monthlyBudget?: number;

  @Column({ type: 'simple-enum', enum: Role, default: Role.STUDENT })
  role: Role;

  @Column({ default: 'ACTIVE' })
  status: string;

  @OneToMany(() => MealProvider, (provider) => provider.user)
  mealProviders: MealProvider[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;
}
