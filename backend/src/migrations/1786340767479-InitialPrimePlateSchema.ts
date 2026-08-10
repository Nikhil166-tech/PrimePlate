import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialPrimePlateSchema1786340767479 implements MigrationInterface {
    name = 'InitialPrimePlateSchema1786340767479'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "daily_menus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "date" date NOT NULL, "items" json NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "mealPlanId" uuid, CONSTRAINT "PK_934c4161c03d4a05822109359a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "meal_plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying NOT NULL, "description" text, "pricePerMonth" numeric(10,2) NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "providerId" uuid, CONSTRAINT "PK_6270d3206d074e2a2520f8d0a0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."meal_providers_status_enum" AS ENUM('ACTIVE', 'CLOSED', 'VACATION', 'TEMPORARILY_UNAVAILABLE')`);
        await queryRunner.query(`CREATE TYPE "public"."meal_providers_category_enum" AS ENUM('Veg', 'Non Veg', 'South Indian', 'North Indian', 'Andhra Meals', 'Healthy', 'Budget')`);
        await queryRunner.query(`CREATE TYPE "public"."meal_providers_approvalstatus_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED')`);
        await queryRunner.query(`CREATE TABLE "meal_providers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid, "name" character varying NOT NULL, "description" text, "address" character varying, "imageUrl" character varying, "city" character varying, "mealType" character varying, "distanceKm" double precision, "budget" double precision, "monthlyPrice" double precision NOT NULL DEFAULT '2999', "rating" double precision NOT NULL DEFAULT '0', "availableToday" boolean NOT NULL DEFAULT false, "verified" boolean NOT NULL DEFAULT false, "status" "public"."meal_providers_status_enum" NOT NULL DEFAULT 'ACTIVE', "category" "public"."meal_providers_category_enum", "approvalStatus" "public"."meal_providers_approvalstatus_enum" NOT NULL DEFAULT 'PENDING', "openingTime" character varying, "closingTime" character varying, "acceptingSubscriptions" boolean NOT NULL DEFAULT true, "totalCapacity" integer NOT NULL DEFAULT '50', "amenities" text, "contactPhone" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_48f07d6037c33932a0b7a34f29f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'PROVIDER', 'STUDENT')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying NOT NULL, "passwordHash" character varying NOT NULL, "name" character varying, "phone" character varying, "area" character varying, "foodPreference" character varying, "monthlyBudget" double precision, "role" "public"."users_role_enum" NOT NULL DEFAULT 'STUDENT', "status" character varying NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenHash" character varying NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c25bc63d248ca90e8dcc1d92d0" ON "refresh_tokens"  ("tokenHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_56b91d98f71e3d1b649ed6e9f3" ON "refresh_tokens"  ("expiresAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_610102b60fea1455310ccd299d" ON "refresh_tokens"  ("userId") `);
        await queryRunner.query(`CREATE TABLE "reviews" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "rating" integer NOT NULL, "comment" text NOT NULL, "providerReply" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "studentId" uuid, "providerId" uuid, CONSTRAINT "PK_231ae565c273ee700b283f15c1d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "amount" numeric(10,2) NOT NULL, "razorpayOrderId" character varying NOT NULL, "razorpayPaymentId" character varying, "razorpaySignature" character varying, "status" character varying NOT NULL DEFAULT 'created', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "studentId" uuid, "providerId" uuid, CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_0d65ce2454954e71c67ea424c4" ON "payments"  ("razorpayOrderId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_487700240ef0deb9acf13f5a37" ON "payments"  ("razorpayPaymentId") `);
        await queryRunner.query(`CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('active', 'paused', 'cancelled', 'expired')`);
        await queryRunner.query(`CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'active', "startDate" date NOT NULL, "endDate" date, "pausedAt" TIMESTAMP, "cancelledAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "studentId" uuid, "mealPlanId" uuid, CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "weekly_menus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "dayOfWeek" integer NOT NULL DEFAULT '0', "mealType" character varying NOT NULL DEFAULT 'Lunch', "menuItems" text, "description" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "providerId" uuid, CONSTRAINT "PK_35c26c470c5e84d5cebf60f3ef6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "daily_menus" ADD CONSTRAINT "FK_dc6a6ba61ed224fc7243df10aae" FOREIGN KEY ("mealPlanId") REFERENCES "meal_plans"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "meal_plans" ADD CONSTRAINT "FK_d3ea9d2e4fc290371c1e98edef2" FOREIGN KEY ("providerId") REFERENCES "meal_providers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "meal_providers" ADD CONSTRAINT "FK_c953deda3cc9005088466c0e7c9" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_63a921d8859a586e1fc91ff4f5f" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reviews" ADD CONSTRAINT "FK_4c29faa8169d9741d3a1d514830" FOREIGN KEY ("providerId") REFERENCES "meal_providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_b2731e10aef7f886a08c552290e" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_a25d33dbd8e95a1875d42ac40c3" FOREIGN KEY ("providerId") REFERENCES "meal_providers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_f62e9a735f10ce6006ac230fcf9" FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_aa2ca1e4560c2c75dde4928016c" FOREIGN KEY ("mealPlanId") REFERENCES "meal_plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "weekly_menus" ADD CONSTRAINT "FK_322fb2b168518ef13a7412a9947" FOREIGN KEY ("providerId") REFERENCES "meal_providers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "weekly_menus" DROP CONSTRAINT "FK_322fb2b168518ef13a7412a9947"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_aa2ca1e4560c2c75dde4928016c"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_f62e9a735f10ce6006ac230fcf9"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_a25d33dbd8e95a1875d42ac40c3"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_b2731e10aef7f886a08c552290e"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_4c29faa8169d9741d3a1d514830"`);
        await queryRunner.query(`ALTER TABLE "reviews" DROP CONSTRAINT "FK_63a921d8859a586e1fc91ff4f5f"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
        await queryRunner.query(`ALTER TABLE "meal_providers" DROP CONSTRAINT "FK_c953deda3cc9005088466c0e7c9"`);
        await queryRunner.query(`ALTER TABLE "meal_plans" DROP CONSTRAINT "FK_d3ea9d2e4fc290371c1e98edef2"`);
        await queryRunner.query(`ALTER TABLE "daily_menus" DROP CONSTRAINT "FK_dc6a6ba61ed224fc7243df10aae"`);
        await queryRunner.query(`DROP TABLE "weekly_menus"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_487700240ef0deb9acf13f5a37"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0d65ce2454954e71c67ea424c4"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TABLE "reviews"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_610102b60fea1455310ccd299d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_56b91d98f71e3d1b649ed6e9f3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c25bc63d248ca90e8dcc1d92d0"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "meal_providers"`);
        await queryRunner.query(`DROP TYPE "public"."meal_providers_approvalstatus_enum"`);
        await queryRunner.query(`DROP TYPE "public"."meal_providers_category_enum"`);
        await queryRunner.query(`DROP TYPE "public"."meal_providers_status_enum"`);
        await queryRunner.query(`DROP TABLE "meal_plans"`);
        await queryRunner.query(`DROP TABLE "daily_menus"`);
    }

}
