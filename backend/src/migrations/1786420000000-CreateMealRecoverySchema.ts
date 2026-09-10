import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add recoveryPercentage to meal_providers + create meal_recoveries table.
 *
 * PostgreSQL-only (Supabase/production target).
 *
 * Design:
 * - recoveryPercentage defaults to 80 (the product default).
 * - meal_recoveries has UNIQUE on sourceSubscriptionId (idempotency guarantee).
 * - Indexes on (studentId, providerId), (providerId, status) for efficient balance queries.
 */
export class CreateMealRecoverySchema1786420000000 implements MigrationInterface {
  name = 'CreateMealRecoverySchema1786420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add recoveryPercentage to meal_providers if not exists
    const hasRecoveryPct = await queryRunner.hasColumn('meal_providers', 'recoveryPercentage');
    if (!hasRecoveryPct) {
      await queryRunner.query(`
        ALTER TABLE "meal_providers"
        ADD COLUMN IF NOT EXISTS "recoveryPercentage" integer NOT NULL DEFAULT 80;
      `);
    }

    // 2. Create meal_recoveries table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "meal_recoveries" (
        "id"                    uuid NOT NULL DEFAULT gen_random_uuid(),
        "studentId"             character varying NOT NULL,
        "providerId"            character varying NOT NULL,
        "sourceSubscriptionId"  character varying NOT NULL,
        "missedDays"            integer NOT NULL,
        "recoveryRate"          integer NOT NULL,
        "recoveredDays"         integer NOT NULL,
        "usedDays"              integer NOT NULL DEFAULT 0,
        "remainingDays"         integer NOT NULL,
        "status"                character varying NOT NULL DEFAULT 'AVAILABLE',
        "processedAt"           timestamp with time zone,
        "createdAt"             timestamp with time zone NOT NULL DEFAULT now(),
        "updatedAt"             timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_meal_recoveries" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_meal_recoveries_source_subscription" UNIQUE ("sourceSubscriptionId")
      );
    `);

    // 3. Create indexes for efficient balance and audit queries
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meal_recoveries_student_provider"
        ON "meal_recoveries" ("studentId", "providerId");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meal_recoveries_provider_status"
        ON "meal_recoveries" ("providerId", "status");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_meal_recoveries_student_id"
        ON "meal_recoveries" ("studentId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_meal_recoveries_student_id";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_meal_recoveries_provider_status";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_meal_recoveries_student_provider";`);

    // Drop meal_recoveries table
    await queryRunner.query(`DROP TABLE IF EXISTS "meal_recoveries";`);

    // Remove recoveryPercentage column
    await queryRunner.query(`
      ALTER TABLE "meal_providers"
      DROP COLUMN IF EXISTS "recoveryPercentage";
    `);
  }
}
