import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/user.entity';
import { MealProvider } from '../providers/meal-provider.entity';

@Entity({ name: 'payments' })
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Index({ unique: true })
  @Column()
  razorpayOrderId: string;

  @Index({ unique: true, sparse: true })
  @Column({ nullable: true })
  razorpayPaymentId?: string;

  @Column({ nullable: true })
  razorpaySignature?: string;

  @Column({ default: 'created' })
  status: string; // created, paid, failed

  @ManyToOne(() => User)
  student: User;

  @ManyToOne(() => MealProvider, {
    nullable: true,
  })
  provider?: MealProvider;

  @CreateDateColumn()
  createdAt: Date;
}
