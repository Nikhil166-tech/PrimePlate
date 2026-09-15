import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'provider_settlement_audits' })
export class ProviderSettlementAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_provider_settlement_audits_admin')
  @Column()
  adminId: string;

  @Column()
  adminEmail: string;

  @Index('IDX_provider_settlement_audits_provider')
  @Column()
  providerId: string;

  @Index('IDX_provider_settlement_audits_earning')
  @Column()
  earningId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column()
  previousStatus: string;

  @Column()
  newStatus: string;

  @Column()
  settlementReference: string;

  @CreateDateColumn()
  createdAt: Date;
}
