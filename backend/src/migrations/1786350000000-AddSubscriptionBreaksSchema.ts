import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionBreaksSchema1786350000000 implements MigrationInterface {
  name = 'AddSubscriptionBreaksSchema1786350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    // Add subscriptionBreaksEnabled to meal_providers table
    const table = await queryRunner.getTable('meal_providers');
    if (table && !table.findColumnByName('subscriptionBreaksEnabled')) {
      if (isPostgres) {
        await queryRunner.query(
          `ALTER TABLE "meal_providers" ADD COLUMN "subscriptionBreaksEnabled" boolean NOT NULL DEFAULT false`,
        );
      } else {
        await queryRunner.query(
          `ALTER TABLE "meal_providers" ADD COLUMN "subscriptionBreaksEnabled" boolean NOT NULL DEFAULT 0`,
        );
      }
    }

    // Create subscription_break_requests table
    if (!(await queryRunner.hasTable('subscription_break_requests'))) {
      if (isPostgres) {
        await queryRunner.query(`
          CREATE TABLE "subscription_break_requests" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "subscriptionId" uuid NOT NULL,
            "studentId" uuid NOT NULL,
            "providerId" uuid NOT NULL,
            "fromDate" date NOT NULL,
            "toDate" date NOT NULL,
            "breakDays" integer NOT NULL,
            "reason" text,
            "status" varchar NOT NULL DEFAULT 'PENDING',
            "requestedAt" TIMESTAMP NOT NULL DEFAULT now(),
            "approvedAt" TIMESTAMP,
            "rejectedAt" TIMESTAMP,
            "approvedById" varchar,
            "rejectedById" varchar,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            "deletedAt" TIMESTAMP,
            CONSTRAINT "PK_subscription_break_requests" PRIMARY KEY ("id"),
            CONSTRAINT "FK_sub_break_subscription" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_sub_break_student" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE,
            CONSTRAINT "FK_sub_break_provider" FOREIGN KEY ("providerId") REFERENCES "meal_providers"("id") ON DELETE CASCADE
          )
        `);
      } else {
        await queryRunner.query(`
          CREATE TABLE "subscription_break_requests" (
            "id" varchar PRIMARY KEY NOT NULL,
            "subscriptionId" varchar NOT NULL,
            "studentId" varchar NOT NULL,
            "providerId" varchar NOT NULL,
            "fromDate" date NOT NULL,
            "toDate" date NOT NULL,
            "breakDays" integer NOT NULL,
            "reason" text,
            "status" varchar NOT NULL DEFAULT 'PENDING',
            "requestedAt" datetime NOT NULL DEFAULT (datetime('now')),
            "approvedAt" datetime,
            "rejectedAt" datetime,
            "approvedById" varchar,
            "rejectedById" varchar,
            "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
            "updatedAt" datetime NOT NULL DEFAULT (datetime('now')),
            "deletedAt" datetime,
            FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("studentId") REFERENCES "users" ("id") ON DELETE CASCADE,
            FOREIGN KEY ("providerId") REFERENCES "meal_providers" ("id") ON DELETE CASCADE
          )
        `);
      }

      // Add indexes
      await queryRunner.query(
        `CREATE INDEX "IDX_sub_break_sub_status" ON "subscription_break_requests" ("subscriptionId", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_sub_break_prov_status" ON "subscription_break_requests" ("providerId", "status")`,
      );
      await queryRunner.query(
        `CREATE INDEX "IDX_sub_break_stud_status" ON "subscription_break_requests" ("studentId", "status")`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "subscription_break_requests"`,
    );
    const table = await queryRunner.getTable('meal_providers');
    if (table && table.findColumnByName('subscriptionBreaksEnabled')) {
      await queryRunner.query(
        `ALTER TABLE "meal_providers" DROP COLUMN "subscriptionBreaksEnabled"`,
      );
    }
  }
}
