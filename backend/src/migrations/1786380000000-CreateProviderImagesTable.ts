import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateProviderImagesTable1786380000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';

    await queryRunner.createTable(
      new Table({
        name: 'provider_images',
        columns: [
          {
            name: 'id',
            type: isPostgres ? 'uuid' : 'varchar',
            isPrimary: true,
            default: isPostgres ? 'gen_random_uuid()' : undefined,
          },
          {
            name: 'providerId',
            type: isPostgres ? 'uuid' : 'varchar',
            isNullable: false,
          },
          {
            name: 'imageUrl',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'sortOrder',
            type: 'int',
            default: 0,
          },
          {
            name: 'createdAt',
            type: isPostgres ? 'timestamp with time zone' : 'datetime',
            default: isPostgres ? 'CURRENT_TIMESTAMP' : "datetime('now')",
          },
          {
            name: 'updatedAt',
            type: isPostgres ? 'timestamp with time zone' : 'datetime',
            default: isPostgres ? 'CURRENT_TIMESTAMP' : "datetime('now')",
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'provider_images',
      new TableIndex({
        name: 'IDX_provider_images_provider_id',
        columnNames: ['providerId'],
      }),
    );

    await queryRunner.createForeignKey(
      'provider_images',
      new TableForeignKey({
        columnNames: ['providerId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'meal_providers',
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('provider_images', true);
  }
}
