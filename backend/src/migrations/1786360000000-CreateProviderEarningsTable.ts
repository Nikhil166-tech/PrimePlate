import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProviderEarningsTable1786360000000 implements MigrationInterface {
  name = 'CreateProviderEarningsTable1786360000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (!(await queryRunner.hasTable('provider_earnings'))) {
      if (isPostgres) {
        await queryRunner.query(`
          CREATE TABLE "provider_earnings" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "paymentId" uuid NOT NULL,
            "subscriptionId" uuid,
            "providerId" uuid NOT NULL,
            "studentId" uuid NOT NULL,
            "grossAmount" numeric(10,2) NOT NULL,
            "platformFee" numeric(10,2) NOT NULL DEFAULT '0.00',
            "providerAmount" numeric(10,2) NOT NULL,
            "status" varchar NOT NULL DEFAULT 'PENDING',
            "earnedAt" TIMESTAMP NOT NULL DEFAULT now(),
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_provider_earnings" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_provider_earnings_paymentId" UNIQUE ("paymentId"),
            CONSTRAINT "FK_provider_earnings_payment" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_provider_earnings_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL,
            CONSTRAINT "FK_provider_earnings_provider" FOREIGN KEY ("providerId") REFERENCES "meal_providers"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_provider_earnings_student" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE
          )
        `);
      } else {
        await queryRunner.query(`
          CREATE TABLE "provider_earnings" (
            "id" varchar PRIMARY KEY NOT NULL,
            "paymentId" varchar NOT NULL UNIQUE,
            "subscriptionId" varchar,
            "providerId" varchar NOT NULL,
            "studentId" varchar NOT NULL,
            "grossAmount" decimal(10,2) NOT NULL,
            "platformFee" decimal(10,2) NOT NULL DEFAULT 0.00,
            "providerAmount" decimal(10,2) NOT NULL,
            "status" varchar NOT NULL DEFAULT 'PENDING',
            "earnedAt" datetime NOT NULL DEFAULT (datetime('now')),
            "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
            "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY ("paymentId") REFERENCES "payments" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions" ("id") ON DELETE SET NULL,
            FOREIGN KEY ("providerId") REFERENCES "meal_providers" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("studentId") REFERENCES "users" ("id") ON DELETE CASCADE
          )
        `);
      }

      await queryRunner.query(
        `CREATE INDEX "IDX_provider_earnings_provider_status" ON "provider_earnings" ("providerId", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_provider_earnings_student" ON "provider_earnings" ("studentId")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "provider_earnings"`);
  }
}
