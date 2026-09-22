import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMealRecoveryEnabledToMealProviders1786500000000
  implements MigrationInterface
{
  name = 'AddMealRecoveryEnabledToMealProviders1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      // 1. Add mealRecoveryEnabled to meal_providers with DEFAULT true
      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'meal_providers' AND column_name = 'mealRecoveryEnabled'
          ) THEN
            ALTER TABLE "meal_providers" ADD COLUMN "mealRecoveryEnabled" boolean NOT NULL DEFAULT true;
          END IF;
        END $$;
      `);

      // 2. Guarantee every existing provider before this feature has mealRecoveryEnabled = true
      await queryRunner.query(`
        UPDATE "meal_providers"
        SET "mealRecoveryEnabled" = true
        WHERE "mealRecoveryEnabled" IS NULL;
      `);
    } else {
      // SQLite support for development / tests
      const hasColumn = await queryRunner.hasColumn(
        'meal_providers',
        'mealRecoveryEnabled',
      );
      if (!hasColumn) {
        await queryRunner.query(`
          ALTER TABLE "meal_providers"
          ADD COLUMN "mealRecoveryEnabled" boolean NOT NULL DEFAULT 1;
        `);
        await queryRunner.query(`
          UPDATE "meal_providers"
          SET "mealRecoveryEnabled" = 1
          WHERE "mealRecoveryEnabled" IS NULL;
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(`
        ALTER TABLE "meal_providers"
        DROP COLUMN IF EXISTS "mealRecoveryEnabled";
      `);
    }
  }
}
