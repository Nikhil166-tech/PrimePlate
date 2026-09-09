import { MigrationInterface, QueryRunner } from 'typeorm';
import * as crypto from 'crypto';

export class CreateMealUsageAndProviderQrSchema1786410000000 implements MigrationInterface {
  name = 'CreateMealUsageAndProviderQrSchema1786410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    // 1. Add qrToken column to meal_providers if not exists
    const hasQrToken = await queryRunner.hasColumn('meal_providers', 'qrToken');
    if (!hasQrToken) {
      if (isPostgres) {
        await queryRunner.query(`
          ALTER TABLE "meal_providers" ADD COLUMN IF NOT EXISTS "qrToken" character varying;
        `);
      } else {
        await queryRunner.query(`
          ALTER TABLE "meal_providers" ADD COLUMN "qrToken" varchar;
        `);
      }
    }

    // 2. Safely backfill existing providers with unique permanent cryptographically secure QR tokens
    const providers: any[] = await queryRunner.query(
      `SELECT "id" FROM "meal_providers" WHERE "qrToken" IS NULL OR "qrToken" = ''`,
    );
    for (const provider of providers) {
      const secureToken = `pp_qr_${crypto.randomBytes(16).toString('hex')}`;
      await queryRunner
        .query(`UPDATE "meal_providers" SET "qrToken" = $1 WHERE "id" = $2`, [
          secureToken,
          provider.id,
        ])
        .catch(async () => {
          // Fallback for SQLite query parameter formatting
          await queryRunner.query(
            `UPDATE "meal_providers" SET "qrToken" = ? WHERE "id" = ?`,
            [secureToken, provider.id],
          );
        });
    }

    // 3. Unique index on meal_providers.qrToken
    if (isPostgres) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_meal_providers_qrToken" ON "meal_providers" ("qrToken");
      `);
    } else {
      await queryRunner
        .query(
          `
        CREATE UNIQUE INDEX IF NOT EXISTS "UQ_meal_providers_qrToken" ON "meal_providers" ("qrToken");
      `,
        )
        .catch(() => {});
    }

    // 4. Create meal_usages table
    if (isPostgres) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "meal_usages" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "studentId" uuid NOT NULL,
          "subscriptionId" uuid NOT NULL,
          "providerId" uuid NOT NULL,
          "mealDate" date NOT NULL,
          "status" character varying NOT NULL DEFAULT 'USED',
          "source" character varying NOT NULL DEFAULT 'QR_SCAN',
          "scannedAt" TIMESTAMP NOT NULL DEFAULT now(),
          "correctedAt" TIMESTAMP,
          "correctedBy" character varying,
          "correctionReason" text,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_meal_usages_id" PRIMARY KEY ("id"),
          CONSTRAINT "UQ_meal_usages_student_date" UNIQUE ("studentId", "mealDate"),
          CONSTRAINT "FK_meal_usages_student" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_meal_usages_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_meal_usages_provider" FOREIGN KEY ("providerId") REFERENCES "meal_providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        );
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_meal_usages_provider_date" ON "meal_usages" ("providerId", "mealDate");
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_meal_usages_student_sub" ON "meal_usages" ("studentId", "subscriptionId");
      `);
    } else {
      // SQLite fallback for local / mock environments
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "meal_usages" (
          "id" varchar PRIMARY KEY NOT NULL,
          "studentId" varchar NOT NULL,
          "subscriptionId" varchar NOT NULL,
          "providerId" varchar NOT NULL,
          "mealDate" date NOT NULL,
          "status" varchar NOT NULL DEFAULT 'USED',
          "source" varchar NOT NULL DEFAULT 'QR_SCAN',
          "scannedAt" datetime NOT NULL DEFAULT (datetime('now')),
          "correctedAt" datetime,
          "correctedBy" varchar,
          "correctionReason" text,
          "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
          "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "UQ_meal_usages_student_date" UNIQUE ("studentId", "mealDate")
        );
      `);

      await queryRunner
        .query(
          `
        CREATE INDEX IF NOT EXISTS "IDX_meal_usages_provider_date" ON "meal_usages" ("providerId", "mealDate");
      `,
        )
        .catch(() => {});
      await queryRunner
        .query(
          `
        CREATE INDEX IF NOT EXISTS "IDX_meal_usages_student_sub" ON "meal_usages" ("studentId", "subscriptionId");
      `,
        )
        .catch(() => {});
    }

    // 5. Create meal_usage_audits table
    if (isPostgres) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "meal_usage_audits" (
          "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
          "mealUsageId" uuid NOT NULL,
          "providerId" uuid NOT NULL,
          "actorId" uuid NOT NULL,
          "subscriptionId" uuid NOT NULL,
          "studentId" uuid NOT NULL,
          "action" character varying NOT NULL,
          "reason" text NOT NULL,
          "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
          CONSTRAINT "PK_meal_usage_audits_id" PRIMARY KEY ("id")
        );
      `);

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_meal_usage_audits_provider" ON "meal_usage_audits" ("providerId");
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_meal_usage_audits_student" ON "meal_usage_audits" ("studentId");
      `);
    } else {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "meal_usage_audits" (
          "id" varchar PRIMARY KEY NOT NULL,
          "mealUsageId" varchar NOT NULL,
          "providerId" varchar NOT NULL,
          "actorId" varchar NOT NULL,
          "subscriptionId" varchar NOT NULL,
          "studentId" varchar NOT NULL,
          "action" varchar NOT NULL,
          "reason" text NOT NULL,
          "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
        );
      `);

      await queryRunner
        .query(
          `
        CREATE INDEX IF NOT EXISTS "IDX_meal_usage_audits_provider" ON "meal_usage_audits" ("providerId");
      `,
        )
        .catch(() => {});
      await queryRunner
        .query(
          `
        CREATE INDEX IF NOT EXISTS "IDX_meal_usage_audits_student" ON "meal_usage_audits" ("studentId");
      `,
        )
        .catch(() => {});
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "meal_usage_audits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "meal_usages"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_meal_providers_qrToken"`);
    // Note: Do not drop qrToken column in down to prevent accidental data loss in production
  }
}
