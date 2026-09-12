import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Enable Row Level Security (RLS) on public.meal_plans
 * and apply least-privilege table grants.
 *
 * Architecture Context:
 * - PrimePlate uses a decoupled architecture: React/Vite frontend calls the NestJS REST API.
 * - Frontend NEVER queries Supabase Data API (PostgREST) directly; @supabase/supabase-js is not used.
 * - Application-level authentication and authorization (RBAC and provider ownership)
 *   are enforced by NestJS (JwtAuthGuard, RolesGuard, and MealPlansService).
 * - NestJS connects to PostgreSQL as the database owner role ('postgres') via DATABASE_URL.
 * - Because 'postgres' is the table owner, it bypasses RLS by default (no FORCE ROW LEVEL SECURITY).
 *
 * Security Actions (up):
 * 1. ALTER TABLE "meal_plans" ENABLE ROW LEVEL SECURITY;
 *    - Resolves Supabase Security Advisor "RLS is disabled" warning.
 * 2. Conditionally REVOKE ALL ON TABLE "meal_plans" FROM "anon" and "authenticated" (if roles exist).
 *    - Closes unintended PostgREST Data API exposure at the table-grant layer (Layer 1).
 *    - Does not fail in environments where these Supabase roles do not exist.
 * 3. Does NOT grant unnecessary privileges to 'service_role' (unused by PrimePlate).
 * 4. Does NOT invent broken auth.uid() = user_id policies (meal_plans has no user_id column).
 *
 * Rollback Actions (down):
 * 1. Conditionally restore default Supabase Data API privileges (SELECT, INSERT, UPDATE, DELETE)
 *    to "anon" and "authenticated" if roles exist.
 * 2. ALTER TABLE "meal_plans" DISABLE ROW LEVEL SECURITY;
 */
export class EnableRlsOnMealPlans1786450000000 implements MigrationInterface {
  name = 'EnableRlsOnMealPlans1786450000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    if (!isPostgres) {
      return;
    }

    // 1. Enable Row Level Security on meal_plans
    await queryRunner.query(
      `ALTER TABLE "meal_plans" ENABLE ROW LEVEL SECURITY;`,
    );

    // 2. Revoke all privileges from anon and authenticated PostgREST roles if they exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          REVOKE ALL ON TABLE "meal_plans" FROM "anon";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          REVOKE ALL ON TABLE "meal_plans" FROM "authenticated";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    if (!isPostgres) {
      return;
    }

    // 1. Restore default Supabase privileges to anon and authenticated if roles exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "meal_plans" TO "anon";
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "meal_plans" TO "authenticated";
        END IF;
      END $$;
    `);

    // 2. Disable Row Level Security on meal_plans
    await queryRunner.query(
      `ALTER TABLE "meal_plans" DISABLE ROW LEVEL SECURITY;`,
    );
  }
}
