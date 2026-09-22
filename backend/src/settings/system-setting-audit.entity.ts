import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'system_setting_audits' })
export class SystemSettingAudit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  adminId: string;

  @Column({ nullable: true })
  adminEmail?: string;

  @Index()
  @Column()
  settingKey: string;

  @Column({ type: 'text', nullable: true })
  previousValue?: string | null;

  @Column({ type: 'text' })
  newValue: string;

  @CreateDateColumn()
  createdAt: Date;
}
