import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCategoryAndMetadataToProviderImages1786390000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    await queryRunner.addColumns('provider_images', [
      new TableColumn({
        name: 'originalFileName',
        type: 'text',
        isNullable: true,
      }),
      new TableColumn({
        name: 'imageType',
        type: isPostgres ? 'varchar' : 'text',
        length: isPostgres ? '100' : undefined,
        isNullable: true,
      }),
      new TableColumn({
        name: 'imageCategory',
        type: isPostgres ? 'varchar' : 'text',
        length: isPostgres ? '100' : undefined,
        isNullable: true,
        default: "'Other'",
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('provider_images', 'imageCategory');
    await queryRunner.dropColumn('provider_images', 'imageType');
    await queryRunner.dropColumn('provider_images', 'originalFileName');
  }
}
