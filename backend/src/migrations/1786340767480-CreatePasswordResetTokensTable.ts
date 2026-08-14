import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePasswordResetTokensTable1786340767480 implements MigrationInterface {
    name = 'CreatePasswordResetTokensTable1786340767480'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "usedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_password_reset_tokens_tokenHash" ON "password_reset_tokens" ("tokenHash")`);
        await queryRunner.query(`CREATE INDEX "IDX_password_reset_tokens_expiresAt" ON "password_reset_tokens" ("expiresAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_password_reset_tokens_userId" ON "password_reset_tokens" ("userId")`);
        await queryRunner.query(`ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_password_reset_tokens_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_password_reset_tokens_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_expiresAt"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_password_reset_tokens_tokenHash"`);
        await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    }
}
