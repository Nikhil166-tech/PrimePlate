import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from './system-setting.entity';
import { SystemSettingAudit } from './system-setting-audit.entity';
import { Payment } from '../payments/payment.entity';

export interface FeeSettingsDto {
  enabled: boolean;
  type: string;
  amount: number;
  label: string;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  // Default fallback constants (Default is OFF per business requirements)
  public static readonly DEFAULT_FEE_ENABLED = false;
  public static readonly DEFAULT_FEE_TYPE = 'FLAT';
  public static readonly DEFAULT_FEE_AMOUNT = 5;
  public static readonly DEFAULT_FEE_LABEL = 'PrimePlate Platform Fee';

  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    @InjectRepository(SystemSettingAudit)
    private readonly auditRepo: Repository<SystemSettingAudit>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
  ) {}

  /**
   * Reads raw setting string with fallback.
   */
  async getSettingValue(key: string, defaultValue: string): Promise<string> {
    try {
      const row = await this.settingRepo.findOne({ where: { key } });
      return row ? row.value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Retrieves current typed platform fee settings.
   */
  async getFeeSettings(): Promise<FeeSettingsDto> {
    const enabledStr = await this.getSettingValue(
      'subscriber_platform_fee_enabled',
      String(SettingsService.DEFAULT_FEE_ENABLED),
    );
    const amountStr = await this.getSettingValue(
      'subscriber_platform_fee_amount',
      String(SettingsService.DEFAULT_FEE_AMOUNT),
    );
    const typeStr = await this.getSettingValue(
      'subscriber_platform_fee_type',
      SettingsService.DEFAULT_FEE_TYPE,
    );
    const labelStr = await this.getSettingValue(
      'subscriber_platform_fee_label',
      SettingsService.DEFAULT_FEE_LABEL,
    );

    const amount = parseFloat(amountStr);

    return {
      enabled: enabledStr === 'true' || enabledStr === '1',
      type: typeStr || SettingsService.DEFAULT_FEE_TYPE,
      amount:
        isNaN(amount) || amount < 0
          ? SettingsService.DEFAULT_FEE_AMOUNT
          : amount,
      label: labelStr || SettingsService.DEFAULT_FEE_LABEL,
    };
  }

  /**
   * Minimal safe public endpoint for students at checkout.
   */
  async getPublicFeeSettings(): Promise<FeeSettingsDto> {
    return this.getFeeSettings();
  }

  /**
   * Updates fee settings with administrative validation and audit logging.
   */
  async updateFeeSettings(
    dto: Partial<FeeSettingsDto>,
    adminUser: { userId: string; email?: string },
  ): Promise<FeeSettingsDto> {
    const current = await this.getFeeSettings();

    // 1. Validation
    if (dto.type !== undefined && dto.type !== 'FLAT') {
      throw new BadRequestException(
        `Unsupported fee type "${dto.type}". Currently only FLAT fee type is supported.`,
      );
    }

    if (dto.amount !== undefined) {
      const amt = Number(dto.amount);
      if (isNaN(amt) || !isFinite(amt) || amt < 0) {
        throw new BadRequestException(
          'Platform fee amount must be a valid number greater than or equal to 0',
        );
      }
    }

    const nextEnabled =
      dto.enabled !== undefined ? Boolean(dto.enabled) : current.enabled;
    const nextType =
      dto.type !== undefined ? dto.type.trim().toUpperCase() : current.type;
    const nextAmount =
      dto.amount !== undefined ? Number(dto.amount) : current.amount;
    const nextLabel =
      dto.label !== undefined ? dto.label.trim() : current.label;

    if (nextEnabled && (!nextLabel || nextLabel.length === 0)) {
      throw new BadRequestException(
        'Display label cannot be empty when platform fee is enabled',
      );
    }

    // 2. Persist changed keys and audit
    const updates: Array<{
      key: string;
      prev: string;
      next: string;
      desc: string;
    }> = [
      {
        key: 'subscriber_platform_fee_enabled',
        prev: String(current.enabled),
        next: String(nextEnabled),
        desc: 'Enable or disable PrimeMate platform fee on checkout',
      },
      {
        key: 'subscriber_platform_fee_amount',
        prev: String(current.amount),
        next: String(nextAmount),
        desc: 'Flat fee amount in INR for subscriber platform fee',
      },
      {
        key: 'subscriber_platform_fee_type',
        prev: current.type,
        next: nextType,
        desc: 'Platform fee pricing model (FLAT initially)',
      },
      {
        key: 'subscriber_platform_fee_label',
        prev: current.label,
        next: nextLabel,
        desc: 'Customer-facing display label on checkout',
      },
    ];

    for (const item of updates) {
      if (item.prev !== item.next) {
        // Save audit trail
        const audit = this.auditRepo.create({
          adminId: adminUser.userId,
          adminEmail: adminUser.email || 'admin@primeplate.com',
          settingKey: item.key,
          previousValue: item.prev,
          newValue: item.next,
          createdAt: new Date(),
        });
        await this.auditRepo.save(audit);

        // Save setting
        let setting = await this.settingRepo.findOne({
          where: { key: item.key },
        });
        if (!setting) {
          setting = this.settingRepo.create({
            key: item.key,
            value: item.next,
            description: item.desc,
            updatedBy: adminUser.userId,
          });
        } else {
          setting.value = item.next;
          setting.updatedBy = adminUser.userId;
        }
        await this.settingRepo.save(setting);
      }
    }

    this.logger.log(
      `ADMIN_UPDATED_FEE_SETTINGS: admin=${adminUser.userId}, enabled=${nextEnabled}, amount=${nextAmount}, type=${nextType}, label="${nextLabel}"`,
    );

    return {
      enabled: nextEnabled,
      type: nextType,
      amount: nextAmount,
      label: nextLabel,
    };
  }

  /**
   * Queries Payment records to generate accurate platform fee KPI metrics.
   * Only 'paid' payments count. Fully refunded payments ('refunded') are excluded.
   */
  async getFeeAnalytics() {
    // 1. Total platform fees collected from successful payments
    const totalCollectedRes = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: 'paid' })
      .select('SUM(p.platformFee)', 'totalFees')
      .addSelect('COUNT(p.id)', 'totalPaidCount')
      .getRawOne();

    const platformFeesCollected = Number(totalCollectedRes?.totalFees) || 0;

    // 2. This Month's platform fees
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );

    const monthCollectedRes = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: 'paid' })
      .andWhere('p.createdAt >= :startOfMonth', { startOfMonth })
      .select('SUM(p.platformFee)', 'monthFees')
      .getRawOne();

    const thisMonthPlatformFees = Number(monthCollectedRes?.monthFees) || 0;

    // 3. Count of subscriptions / payments with platform fee > 0
    const withFeeRes = await this.paymentRepo
      .createQueryBuilder('p')
      .where('p.status = :status', { status: 'paid' })
      .andWhere('p.platformFee > 0')
      .select('COUNT(p.id)', 'countWithFee')
      .getRawOne();

    const subscriptionsWithFee = Number(withFeeRes?.countWithFee) || 0;

    // 4. Average platform fee
    const averagePlatformFee =
      subscriptionsWithFee > 0
        ? Math.round((platformFeesCollected / subscriptionsWithFee) * 100) / 100
        : 0;

    return {
      platformFeesCollected,
      thisMonthPlatformFees,
      subscriptionsWithFee,
      averagePlatformFee,
    };
  }

  /**
   * Retrieves recent fee configuration audit logs.
   */
  async getFeeAudits(limit = 20): Promise<SystemSettingAudit[]> {
    return this.auditRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
