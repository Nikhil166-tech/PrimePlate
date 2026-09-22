import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSystemSettingsAndAudits1786510000000 implements MigrationInterface {
  name = 'CreateSystemSettingsAndAudits1786510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      // 1. Create system_settings table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "system_settings" (
          "key" varchar PRIMARY KEY,
          "value" text NOT NULL,
          "description" text,
          "updatedBy" varchar,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
        );
      `);

      // 2. Create system_setting_audits table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "system_setting_audits" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "adminId" varchar NOT NULL,
          "adminEmail" varchar,
          "settingKey" varchar NOT NULL,
          "previousValue" text,
          "newValue" text NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now()
        );
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_system_setting_audits_key"
        ON "system_setting_audits" ("settingKey");
      `);

      // 3. Add columns to payments table
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'payments' AND column_name = 'mealAmount'
          ) THEN
            ALTER TABLE "payments" ADD COLUMN "mealAmount" decimal(10,2) NOT NULL DEFAULT 0;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'payments' AND column_name = 'platformFee'
          ) THEN
            ALTER TABLE "payments" ADD COLUMN "platformFee" decimal(10,2) NOT NULL DEFAULT 0;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'payments' AND column_name = 'totalAmount'
          ) THEN
            ALTER TABLE "payments" ADD COLUMN "totalAmount" decimal(10,2);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'payments' AND column_name = 'platformFeeType'
          ) THEN
            ALTER TABLE "payments" ADD COLUMN "platformFeeType" varchar(32);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'payments' AND column_name = 'platformFeeLabel'
          ) THEN
            ALTER TABLE "payments" ADD COLUMN "platformFeeLabel" varchar(128);
          END IF;
        END $$;
      `);

      // 4. Backfill existing payments so mealAmount = amount, totalAmount = amount
      await queryRunner.query(`
        UPDATE "payments"
        SET "mealAmount" = "amount", "totalAmount" = "amount"
        WHERE "mealAmount" = 0 AND "amount" > 0;
      `);

      // 5. Seed default settings (Default OFF per business requirements)
      await queryRunner.query(`
        INSERT INTO "system_settings" ("key", "value", "description", "updatedAt")
        VALUES 
          ('subscriber_platform_fee_enabled', 'false', 'Enable or disable PrimeMate platform fee on checkout', now()),
          ('subscriber_platform_fee_amount', '5', 'Flat fee amount in INR for subscriber platform fee', now()),
          ('subscriber_platform_fee_type', 'FLAT', 'Platform fee pricing model (FLAT initially)', now()),
          ('subscriber_platform_fee_label', 'PrimePlate Platform Fee', 'Customer-facing display label on checkout', now())
        ON CONFLICT ("key") DO NOTHING;
      `);
    } else {
      // SQLite support for local dev and automated tests
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "system_settings" (
          "key" varchar PRIMARY KEY,
          "value" text NOT NULL,
          "description" text,
          "updatedBy" varchar,
          "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
        );
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "system_setting_audits" (
          "id" varchar PRIMARY KEY,
          "adminId" varchar NOT NULL,
          "adminEmail" varchar,
          "settingKey" varchar NOT NULL,
          "previousValue" text,
          "newValue" text NOT NULL,
          "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
        );
      `);

      const hasMealAmount = await queryRunner.hasColumn(
        'payments',
        'mealAmount',
      );
      if (!hasMealAmount) {
        await queryRunner.query(
          `ALTER TABLE "payments" ADD COLUMN "mealAmount" decimal(10,2) NOT NULL DEFAULT 0;`,
        );
      }

      const hasPlatformFee = await queryRunner.hasColumn(
        'payments',
        'platformFee',
      );
      if (!hasPlatformFee) {
        await queryRunner.query(
          `ALTER TABLE "payments" ADD COLUMN "platformFee" decimal(10,2) NOT NULL DEFAULT 0;`,
        );
      }

      const hasTotalAmount = await queryRunner.hasColumn(
        'payments',
        'totalAmount',
      );
      if (!hasTotalAmount) {
        await queryRunner.query(
          `ALTER TABLE "payments" ADD COLUMN "totalAmount" decimal(10,2);`,
        );
      }

      const hasPlatformFeeType = await queryRunner.hasColumn(
        'payments',
        'platformFeeType',
      );
      if (!hasPlatformFeeType) {
        await queryRunner.query(
          `ALTER TABLE "payments" ADD COLUMN "platformFeeType" varchar(32);`,
        );
      }

      const hasPlatformFeeLabel = await queryRunner.hasColumn(
        'payments',
        'platformFeeLabel',
      );
      if (!hasPlatformFeeLabel) {
        await queryRunner.query(
          `ALTER TABLE "payments" ADD COLUMN "platformFeeLabel" varchar(128);`,
        );
      }

      await queryRunner.query(`
        UPDATE "payments"
        SET "mealAmount" = "amount", "totalAmount" = "amount"
        WHERE "mealAmount" = 0 AND "amount" > 0;
      `);

      await queryRunner.query(`
        INSERT OR IGNORE INTO "system_settings" ("key", "value", "description")
        VALUES 
          ('subscriber_platform_fee_enabled', 'false', 'Enable or disable PrimeMate platform fee on checkout'),
          ('subscriber_platform_fee_amount', '5', 'Flat fee amount in INR for subscriber platform fee'),
          ('subscriber_platform_fee_type', 'FLAT', 'Platform fee pricing model (FLAT initially)'),
          ('subscriber_platform_fee_label', 'PrimePlate Platform Fee', 'Customer-facing display label on checkout');
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "system_setting_audits";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "system_settings";`);
  }
}
