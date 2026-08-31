import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'payment_webhook_events' })
export class PaymentWebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  eventId: string;

  @Column()
  eventType: string;

  @CreateDateColumn()
  processedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
