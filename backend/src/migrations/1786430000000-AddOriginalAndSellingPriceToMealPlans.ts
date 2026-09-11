import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOriginalAndSellingPriceToMealPlans1786430000000
  implements MigrationInterface
{
  name = 'AddOriginalAndSellingPriceToMealPlans1786430000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add columns as nullable initially to allow backfilling existing records
    await queryRunner.query(
      `ALTER TABLE "meal_plans" ADD COLUMN "originalPrice" numeric(10,2)`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_plans" ADD COLUMN "sellingPrice" numeric(10,2)`,
    );

    // 2. Backfill existing meal plans: originalPrice = pricePerMonth, sellingPrice = pricePerMonth
    // Existing plans initially have no artificial discount (sellingPrice == originalPrice)
    await queryRunner.query(
      `UPDATE "meal_plans" 
       SET "originalPrice" = COALESCE("pricePerMonth", 2999.00),
           "sellingPrice" = COALESCE("pricePerMonth", 2999.00)
       WHERE "originalPrice" IS NULL OR "sellingPrice" IS NULL`,
    );

    // 3. Apply NOT NULL constraints
    await queryRunner.query(
      `ALTER TABLE "meal_plans" ALTER COLUMN "originalPrice" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_plans" ALTER COLUMN "sellingPrice" SET NOT NULL`,
    );

    // 4. Add check constraints ensuring originalPrice > 0, sellingPrice > 0, sellingPrice <= originalPrice
    await queryRunner.query(
      `ALTER TABLE "meal_plans" ADD CONSTRAINT "CHK_meal_plans_pricing" 
       CHECK ("originalPrice" > 0 AND "sellingPrice" > 0 AND "sellingPrice" <= "originalPrice")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meal_plans" DROP CONSTRAINT IF EXISTS "CHK_meal_plans_pricing"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_plans" DROP COLUMN IF EXISTS "sellingPrice"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meal_plans" DROP COLUMN IF EXISTS "originalPrice"`,
    );
  }
}
