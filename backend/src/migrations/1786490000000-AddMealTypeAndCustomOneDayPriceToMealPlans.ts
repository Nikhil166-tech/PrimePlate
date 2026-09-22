import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMealTypeAndCustomOneDayPriceToMealPlans1786490000000 implements MigrationInterface {
  name = 'AddMealTypeAndCustomOneDayPriceToMealPlans1786490000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      // 1. Add mealType as nullable initially to safely backfill
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'meal_plans' AND column_name = 'mealType'
          ) THEN
            ALTER TABLE "meal_plans" ADD COLUMN "mealType" varchar(32) DEFAULT 'FULL_DAY';
          END IF;
        END $$;
      `);

      // 2. Backfill historical plans to FULL_DAY (as they historically represent breakfast + lunch + dinner)
      await queryRunner.query(`
        UPDATE "meal_plans"
        SET "mealType" = 'FULL_DAY'
        WHERE "mealType" IS NULL;
      `);

      // 3. Set NOT NULL on mealType and add CHK constraint
      await queryRunner.query(`
        ALTER TABLE "meal_plans" ALTER COLUMN "mealType" SET NOT NULL;
      `);

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'CHK_meal_plans_meal_type'
          ) THEN
            ALTER TABLE "meal_plans" ADD CONSTRAINT "CHK_meal_plans_meal_type"
            CHECK ("mealType" IN ('FULL_DAY', 'LUNCH_ONLY', 'DINNER_ONLY'));
          END IF;
        END $$;
      `);

      // 4. Add customOneDayPrice (nullable by default for legacy plans)
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'meal_plans' AND column_name = 'customOneDayPrice'
          ) THEN
            ALTER TABLE "meal_plans" ADD COLUMN "customOneDayPrice" numeric(10,2);
          END IF;
        END $$;
      `);

      // 5. Add check constraint for customOneDayPrice > 0 if specified
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'CHK_meal_plans_custom_one_day_price'
          ) THEN
            ALTER TABLE "meal_plans" ADD CONSTRAINT "CHK_meal_plans_custom_one_day_price"
            CHECK ("customOneDayPrice" IS NULL OR "customOneDayPrice" > 0);
          END IF;
        END $$;
      `);
    } else {
      // SQLite fallback
      const tableInfo: any[] = await queryRunner.query(
        `PRAGMA table_info("meal_plans")`,
      );
      const hasMealType = tableInfo.some((col: any) => col.name === 'mealType');
      const hasCustomOneDayPrice = tableInfo.some(
        (col: any) => col.name === 'customOneDayPrice',
      );

      if (!hasMealType) {
        await queryRunner.query(
          `ALTER TABLE "meal_plans" ADD COLUMN "mealType" varchar(32) NOT NULL DEFAULT 'FULL_DAY'`,
        );
      }
      if (!hasCustomOneDayPrice) {
        await queryRunner.query(
          `ALTER TABLE "meal_plans" ADD COLUMN "customOneDayPrice" decimal(10,2)`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE "meal_plans" DROP CONSTRAINT IF EXISTS "CHK_meal_plans_custom_one_day_price";
        ALTER TABLE "meal_plans" DROP CONSTRAINT IF EXISTS "CHK_meal_plans_meal_type";
        ALTER TABLE "meal_plans" DROP COLUMN IF EXISTS "customOneDayPrice";
        ALTER TABLE "meal_plans" DROP COLUMN IF EXISTS "mealType";
      `);
    }
  }
}
