import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionBreaksSchema1786350000000 implements MigrationInterface {
  name = 'AddSubscriptionBreaksSchema1786350000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op
  }
}
