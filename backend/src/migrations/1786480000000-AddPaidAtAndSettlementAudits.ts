import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaidAtAndSettlementAudits1786480000000 implements MigrationInterface {
  name = 'AddPaidAtAndSettlementAudits1786480000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      // 1. Add paidAt and settlementReference columns to provider_earnings
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'provider_earnings' AND column_name = 'paidAt'
          ) THEN
            ALTER TABLE "provider_earnings" ADD COLUMN "paidAt" TIMESTAMP;
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'provider_earnings' AND column_name = 'settlementReference'
          ) THEN
            ALTER TABLE "provider_earnings" ADD COLUMN "settlementReference" varchar(255);
          END IF;
        END $$;
      `);

      // 2. Create provider_settlement_audits table
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "provider_settlement_audits" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "adminId" varchar NOT NULL,
          "adminEmail" varchar NOT NULL,
          "providerId" varchar NOT NULL,
          "earningId" varchar NOT NULL,
          "amount" numeric(10,2) NOT NULL,
          "previousStatus" varchar NOT NULL,
          "newStatus" varchar NOT NULL,
          "settlementReference" varchar NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_provider_settlement_audits" PRIMARY KEY ("id")
        );
      `);

      // 3. Create indexes
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_provider_settlement_audits_provider" ON "provider_settlement_audits" ("providerId");
        CREATE INDEX IF NOT EXISTS "IDX_provider_settlement_audits_earning" ON "provider_settlement_audits" ("earningId");
        CREATE INDEX IF NOT EXISTS "IDX_provider_settlement_audits_admin" ON "provider_settlement_audits" ("adminId");
      `);

      // 4. Enable RLS and revoke anon/authenticated PostgREST privileges
      await queryRunner.query(`
        ALTER TABLE IF EXISTS "provider_settlement_audits" ENABLE ROW LEVEL SECURITY;
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            REVOKE ALL ON TABLE "provider_settlement_audits" FROM anon;
          END IF;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            REVOKE ALL ON TABLE "provider_settlement_audits" FROM authenticated;
          END IF;
        END $$;
      `);
    } else {
      // SQLite fallback
      // Check if columns exist before altering
      const tableInfo: any[] = await queryRunner.query(
        `PRAGMA table_info("provider_earnings")`,
      );
      const hasPaidAt = tableInfo.some((col: any) => col.name === 'paidAt');
      const hasSettlementRef = tableInfo.some(
        (col: any) => col.name === 'settlementReference',
      );

      if (!hasPaidAt) {
        await queryRunner.query(
          `ALTER TABLE "provider_earnings" ADD COLUMN "paidAt" datetime`,
        );
      }
      if (!hasSettlementRef) {
        await queryRunner.query(
          `ALTER TABLE "provider_earnings" ADD COLUMN "settlementReference" varchar`,
        );
      }

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "provider_settlement_audits" (
          "id" varchar PRIMARY KEY NOT NULL,
          "adminId" varchar NOT NULL,
          "adminEmail" varchar NOT NULL,
          "providerId" varchar NOT NULL,
          "earningId" varchar NOT NULL,
          "amount" decimal(10,2) NOT NULL,
          "previousStatus" varchar NOT NULL,
          "newStatus" varchar NOT NULL,
          "settlementReference" varchar NOT NULL,
          "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
        );
      `);

      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_provider_settlement_audits_provider" ON "provider_settlement_audits" ("providerId");`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_provider_settlement_audits_earning" ON "provider_settlement_audits" ("earningId");`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    await queryRunner.query(`DROP TABLE IF EXISTS "provider_settlement_audits"`);

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE "provider_earnings" 
        DROP COLUMN IF EXISTS "paidAt",
        DROP COLUMN IF EXISTS "settlementReference";
      `);
    }
  }
}
