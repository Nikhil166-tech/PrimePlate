import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { MealProvider } from './meal-provider.entity';

@Entity('provider_images')
export class ProviderImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  providerId: string;

  @ManyToOne(() => MealProvider, (provider) => provider.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'providerId' })
  provider: MealProvider;

  @Column({ type: 'text' })
  imageUrl: string;

  @Column({ type: 'text', nullable: true })
  originalFileName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  imageType?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, default: 'Other' })
  imageCategory?: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
