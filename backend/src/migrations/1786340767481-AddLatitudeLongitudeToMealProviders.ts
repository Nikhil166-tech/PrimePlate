import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLatitudeLongitudeToMealProviders1786340767481 implements MigrationInterface {
  name = 'AddLatitudeLongitudeToMealProviders1786340767481';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meal_providers" ADD COLUMN IF NOT EXISTS "latitude" double precision, ADD COLUMN IF NOT EXISTS "longitude" double precision;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "meal_providers" DROP COLUMN IF EXISTS "latitude", DROP COLUMN IF EXISTS "longitude";`,
    );
  }
}
