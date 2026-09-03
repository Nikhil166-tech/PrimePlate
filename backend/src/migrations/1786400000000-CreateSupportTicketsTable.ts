import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSupportTicketsTable1786400000000
  implements MigrationInterface
{
  name = 'CreateSupportTicketsTable1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_tickets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "ticketNumber" character varying NOT NULL,
        "razorpayOrderId" character varying NOT NULL,
        "razorpayPaymentId" character varying,
        "issueType" character varying NOT NULL DEFAULT 'OTHER',
        "description" text NOT NULL,
        "utrReference" character varying,
        "status" character varying NOT NULL DEFAULT 'OPEN',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        "studentId" uuid,
        "paymentId" uuid,
        CONSTRAINT "UQ_support_tickets_ticketNumber" UNIQUE ("ticketNumber"),
        CONSTRAINT "PK_support_tickets_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_support_tickets_student" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_support_tickets_payment" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_support_tickets_razorpayOrderId" ON "support_tickets" ("razorpayOrderId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_support_tickets_razorpayOrderId"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "support_tickets"
    `);
  }
}
