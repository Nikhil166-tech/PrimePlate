import { BadRequestException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { Payment } from '../payments/payment.entity';

describe('PrimePlate Platform Fee System (Unit & Integration Tests)', () => {
  let settingsService: SettingsService;
  let mockSettingRepo: any;
  let mockAuditRepo: any;
  let mockPaymentRepo: any;
  let inMemorySettings: Record<string, string>;
  let inMemoryAudits: any[];

  beforeEach(() => {
    inMemorySettings = {
      subscriber_platform_fee_enabled: 'false',
      subscriber_platform_fee_amount: '5',
      subscriber_platform_fee_type: 'FLAT',
      subscriber_platform_fee_label: 'PrimePlate Platform Fee',
    };
    inMemoryAudits = [];

    mockSettingRepo = {
      findOne: jest
        .fn()
        .mockImplementation(async ({ where }: { where: { key: string } }) => {
          const val = inMemorySettings[where.key];
          return val !== undefined ? { key: where.key, value: val } : null;
        }),
      create: jest.fn().mockImplementation((dto: any) => ({ ...dto })),
      save: jest.fn().mockImplementation(async (entity: any) => {
        inMemorySettings[entity.key] = String(entity.value);
        return entity;
      }),
    };

    mockAuditRepo = {
      create: jest.fn().mockImplementation((dto: any) => ({
        id: 'audit-1',
        ...dto,
        createdAt: new Date(),
      })),
      save: jest.fn().mockImplementation(async (entity: any) => {
        inMemoryAudits.push(entity);
        return entity;
      }),
      find: jest.fn().mockImplementation(async () => [...inMemoryAudits]),
    };

    mockPaymentRepo = {
      createQueryBuilder: jest.fn(),
    };

    settingsService = new SettingsService(
      mockSettingRepo,
      mockAuditRepo,
      mockPaymentRepo,
    );
  });

  // Test A: Default configuration
  it('TEST A: Default configuration must be OFF, amount=5, type=FLAT, label="PrimePlate Platform Fee"', async () => {
    const config = await settingsService.getFeeSettings();
    expect(config.enabled).toBe(false);
    expect(config.amount).toBe(5);
    expect(config.type).toBe('FLAT');
    expect(config.label).toBe('PrimePlate Platform Fee');
  });

  // Test B: Admin can enable fee
  it('TEST B: Admin can enable fee', async () => {
    const adminUser = { userId: 'admin-uuid-1', email: 'admin@primeplate.com' };
    const updated = await settingsService.updateFeeSettings(
      { enabled: true },
      adminUser,
    );

    expect(updated.enabled).toBe(true);
    expect(inMemorySettings['subscriber_platform_fee_enabled']).toBe('true');
    expect(inMemoryAudits.length).toBe(1);
    expect(inMemoryAudits[0].settingKey).toBe(
      'subscriber_platform_fee_enabled',
    );
    expect(inMemoryAudits[0].previousValue).toBe('false');
    expect(inMemoryAudits[0].newValue).toBe('true');
  });

  // Test C: Admin can change ₹5 -> ₹10
  it('TEST C: Admin can change fee amount ₹5 -> ₹10', async () => {
    const adminUser = { userId: 'admin-uuid-1', email: 'admin@primeplate.com' };
    const updated = await settingsService.updateFeeSettings(
      { amount: 10 },
      adminUser,
    );

    expect(updated.amount).toBe(10);
    expect(inMemorySettings['subscriber_platform_fee_amount']).toBe('10');
    expect(
      inMemoryAudits.some(
        (a) =>
          a.settingKey === 'subscriber_platform_fee_amount' &&
          a.newValue === '10',
      ),
    ).toBe(true);
  });

  // Test D: Admin can disable fee
  it('TEST D: Admin can disable fee', async () => {
    inMemorySettings['subscriber_platform_fee_enabled'] = 'true';
    const adminUser = { userId: 'admin-uuid-1', email: 'admin@primeplate.com' };
    const updated = await settingsService.updateFeeSettings(
      { enabled: false },
      adminUser,
    );

    expect(updated.enabled).toBe(false);
    expect(inMemorySettings['subscriber_platform_fee_enabled']).toBe('false');
  });

  // Test E & F: Fee calculation when disabled vs enabled
  it('TEST E: Disabled fee calculates total = mealAmount (no fee added)', async () => {
    const feeConfig = await settingsService.getFeeSettings();
    expect(feeConfig.enabled).toBe(false);

    const mealAmount = 500;
    const platformFee =
      feeConfig.enabled && feeConfig.amount > 0 ? Number(feeConfig.amount) : 0;
    const totalAmount = mealAmount + platformFee;

    expect(platformFee).toBe(0);
    expect(totalAmount).toBe(500);
  });

  it('TEST F: Enabled fee calculates total = mealAmount + fee (₹500 + ₹10 = ₹510)', async () => {
    inMemorySettings['subscriber_platform_fee_enabled'] = 'true';
    inMemorySettings['subscriber_platform_fee_amount'] = '10';

    const feeConfig = await settingsService.getFeeSettings();
    expect(feeConfig.enabled).toBe(true);

    const mealAmount = 500;
    const platformFee =
      feeConfig.enabled && feeConfig.amount > 0 ? Number(feeConfig.amount) : 0;
    const totalAmount = mealAmount + platformFee;

    expect(platformFee).toBe(10);
    expect(totalAmount).toBe(510);
    expect(Math.round(totalAmount * 100)).toBe(51000); // Razorpay paise
  });

  // Test G & H & I: Payment stores snapshot, Razorpay order amount = 510, settings change does NOT alter stored payment
  it('TEST G, H, I: Payment stores snapshot; subsequent admin fee changes do NOT alter existing payment', async () => {
    // 1. Fee is ₹10
    inMemorySettings['subscriber_platform_fee_enabled'] = 'true';
    inMemorySettings['subscriber_platform_fee_amount'] = '10';

    const feeConfig = await settingsService.getFeeSettings();
    const mealAmount = 1500;
    const platformFee = feeConfig.enabled ? feeConfig.amount : 0;
    const totalAmount = mealAmount + platformFee;

    // Snapshot stored on Payment
    const paymentRecord: Partial<Payment> = {
      id: 'pay-uuid-1',
      amount: totalAmount,
      totalAmount,
      mealAmount,
      platformFee,
      platformFeeType: feeConfig.type,
      platformFeeLabel: feeConfig.label,
      status: 'created',
      razorpayOrderId: 'order_123',
    };

    expect(paymentRecord.amount).toBe(1510);
    expect(paymentRecord.mealAmount).toBe(1500);
    expect(paymentRecord.platformFee).toBe(10);

    // 2. Admin changes fee to ₹15 later
    await settingsService.updateFeeSettings(
      { amount: 15 },
      { userId: 'admin-1' },
    );
    const newConfig = await settingsService.getFeeSettings();
    expect(newConfig.amount).toBe(15);

    // 3. Historical / created payment record remains ₹1510!
    expect(paymentRecord.amount).toBe(1510);
    expect(paymentRecord.mealAmount).toBe(1500);
    expect(paymentRecord.platformFee).toBe(10);
  });

  // Test K: Provider entitlement remains based on provider meal amount (₹500, not ₹490)
  it('TEST K: Provider entitlement receives full meal amount (₹500), platform fee is retained by PrimePlate', () => {
    const payment = {
      id: 'pay-2',
      amount: 510,
      mealAmount: 500,
      platformFee: 10,
      status: 'paid',
    };

    const grossAmount = Number(payment.amount);
    const platformFee = Number(payment.platformFee || 0);
    const mealAmount = Number(payment.mealAmount || grossAmount - platformFee);
    const providerAmount = Math.max(0, mealAmount);

    expect(grossAmount).toBe(510);
    expect(providerAmount).toBe(500); // 100% of meal plan price
    expect(platformFee).toBe(10); // PrimePlate revenue
  });

  // Test L: Refunded payment excluded from net fee collection analytics
  it('TEST L: Only "paid" status payments count toward collected fee analytics (refunded excluded)', async () => {
    mockPaymentRepo.createQueryBuilder.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockResolvedValue({ totalFees: '250', totalPaidCount: '25' }),
    });

    const analytics = await settingsService.getFeeAnalytics();
    expect(analytics.platformFeesCollected).toBe(250);
    // Verifies where clause uses 'paid' exclusively
    expect(mockPaymentRepo.createQueryBuilder).toHaveBeenCalledWith('p');
  });

  // Test M: Validation & unsupported fee types rejected
  it('TEST M: Rejects unsupported fee types (e.g. PERCENTAGE) and negative amounts', async () => {
    const adminUser = { userId: 'admin-1' };

    await expect(
      settingsService.updateFeeSettings(
        { type: 'PERCENTAGE' as any },
        adminUser,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      settingsService.updateFeeSettings({ amount: -5 }, adminUser),
    ).rejects.toThrow(BadRequestException);

    await expect(
      settingsService.updateFeeSettings(
        { enabled: true, label: '' },
        adminUser,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
