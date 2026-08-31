import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePaymentWebhookEventsAndExtendPayments1786370000000 implements MigrationInterface {
  name = 'CreatePaymentWebhookEventsAndExtendPayments1786370000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    // 1. Create payment_webhook_events table
    if (!(await queryRunner.hasTable('payment_webhook_events'))) {
      if (isPostgres) {
        await queryRunner.query(`
          CREATE TABLE "payment_webhook_events" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "eventId" varchar NOT NULL,
            "eventType" varchar NOT NULL,
            "processedAt" TIMESTAMP NOT NULL DEFAULT now(),
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_payment_webhook_events" PRIMARY KEY ("id"),
            CONSTRAINT "UQ_payment_webhook_events_eventId" UNIQUE ("eventId")
          )
        `);
      } else {
        await queryRunner.query(`
          CREATE TABLE "payment_webhook_events" (
            "id" varchar PRIMARY KEY NOT NULL,
            "eventId" varchar NOT NULL UNIQUE,
            "eventType" varchar NOT NULL,
            "processedAt" datetime NOT NULL DEFAULT (datetime('now')),
            "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
          )
        `);
      }

      await queryRunner.query(
        `CREATE UNIQUE INDEX "IDX_payment_webhook_events_eventId" ON "payment_webhook_events" ("eventId")`,
      );
    }

    // 2. Add durationDays and mealPlanId to payments table if not already present
    if (await queryRunner.hasTable('payments')) {
      const hasDurationDays = await queryRunner.hasColumn(
        'payments',
        'durationDays',
      );
      if (!hasDurationDays) {
        if (isPostgres) {
          await queryRunner.query(
            `ALTER TABLE "payments" ADD "durationDays" integer`,
          );
        } else {
          await queryRunner.query(
            `ALTER TABLE "payments" ADD COLUMN "durationDays" integer`,
          );
        }
      }

      const hasMealPlanId = await queryRunner.hasColumn(
        'payments',
        'mealPlanId',
      );
      if (!hasMealPlanId) {
        if (isPostgres) {
          await queryRunner.query(
            `ALTER TABLE "payments" ADD "mealPlanId" varchar`,
          );
        } else {
          await queryRunner.query(
            `ALTER TABLE "payments" ADD COLUMN "mealPlanId" varchar`,
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "payment_webhook_events"`);
  }
}
