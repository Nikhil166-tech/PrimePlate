import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Add recoveryDaysApplied to subscriptions table.
 *
 * PostgreSQL-compatible for Supabase / production.
 * Defaults to 0 so all existing subscriptions remain historically valid and intact.
 */
export class AddRecoveryDaysAppliedToSubscriptions1786440000000 implements MigrationInterface {
  name = 'AddRecoveryDaysAppliedToSubscriptions1786440000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasCol = await queryRunner.hasColumn('subscriptions', 'recoveryDaysApplied');
    if (!hasCol) {
      await queryRunner.query(`
        ALTER TABLE "subscriptions"
        ADD COLUMN IF NOT EXISTS "recoveryDaysApplied" integer NOT NULL DEFAULT 0;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscriptions"
      DROP COLUMN IF EXISTS "recoveryDaysApplied";
    `);
  }
}
