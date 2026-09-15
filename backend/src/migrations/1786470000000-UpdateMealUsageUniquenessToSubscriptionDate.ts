import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Update meal check-in uniqueness constraint from (studentId, mealDate)
 * to (subscriptionId, mealDate).
 *
 * Business Rationale:
 * - A student may legitimately hold distinct subscriptions (e.g. lunch at Provider A,
 *   dinner at Provider B, or multiple concurrent meal plan subscriptions).
 * - The entitlement is anchored to the active Subscription.
 * - Enforces exactly one check-in per calendar day per subscription entitlement.
 * - Prevents duplicate scans for the same subscription while allowing legitimate check-ins
 *   across separate subscriptions/providers on the same calendar day.
 */
export class UpdateMealUsageUniquenessToSubscriptionDate1786470000000 implements MigrationInterface {
  name = 'UpdateMealUsageUniquenessToSubscriptionDate1786470000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`
        DO $$
        BEGIN
          -- Drop old constraint if it exists
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_meal_usages_student_date') THEN
            ALTER TABLE "meal_usages" DROP CONSTRAINT "UQ_meal_usages_student_date";
          END IF;

          -- Add new subscription-level uniqueness constraint
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_meal_usages_subscription_date') THEN
            ALTER TABLE "meal_usages" ADD CONSTRAINT "UQ_meal_usages_subscription_date" UNIQUE ("subscriptionId", "mealDate");
          END IF;
        END $$;
      `);
    } else {
      // SQLite fallback: create unique index on (subscriptionId, mealDate)
      await queryRunner
        .query(
          `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_meal_usages_subscription_date" ON "meal_usages" ("subscriptionId", "mealDate");`,
        )
        .catch(() => {});
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_meal_usages_subscription_date') THEN
            ALTER TABLE "meal_usages" DROP CONSTRAINT "UQ_meal_usages_subscription_date";
          END IF;

          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UQ_meal_usages_student_date') THEN
            ALTER TABLE "meal_usages" ADD CONSTRAINT "UQ_meal_usages_student_date" UNIQUE ("studentId", "mealDate");
          END IF;
        END $$;
      `);
    } else {
      await queryRunner
        .query(`DROP INDEX IF EXISTS "UQ_meal_usages_subscription_date";`)
        .catch(() => {});
    }
  }
}
