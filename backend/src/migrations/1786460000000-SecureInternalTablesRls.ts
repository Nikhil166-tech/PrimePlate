import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Enable Row Level Security (RLS) on internal/sensitive tables
 * and revoke PostgREST Data API privileges from anon and authenticated roles.
 *
 * Architecture Context:
 * - PrimePlate uses a decoupled architecture: React/Vite frontend communicates
 *   strictly with the NestJS REST API.
 * - PostgREST Data API is NOT used by clients (@supabase/supabase-js is not used).
 * - Authentication & Authorization are enforced by NestJS (JwtAuthGuard, RolesGuard, RBAC).
 * - NestJS connects as database owner ('postgres') via DATABASE_URL and bypasses RLS.
 * - This migration enables RLS as defense-in-depth on sensitive backend tables
 *   and revokes anon/authenticated PostgREST privileges.
 */
export class SecureInternalTablesRls1786460000000 implements MigrationInterface {
  name = 'SecureInternalTablesRls1786460000000';

  private readonly sensitiveTables = [
    'users',
    'payments',
    'subscriptions',
    'provider_earnings',
    'payment_webhook_events',
    'password_reset_tokens',
    'refresh_tokens',
    'meal_usages',
    'meal_usage_audits',
    'meal_recoveries',
    'support_tickets',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.connection.options.type === 'postgres';
    if (!isPostgres) {
      return;
    }

    // 1. Enable Row Level Security on all sensitive internal tables
    for (const table of this.sensitiveTables) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "${table}" ENABLE ROW LEVEL SECURITY;`,
      );
    }

    // 2. Revoke all privileges from anon and authenticated PostgREST roles safely
    await queryRunner.query(`
      DO $$
      DECLARE
        tbl text;
        tables text[] := ARRAY[
          'users',
          'payments',
          'subscriptions',
          'provider_earnings',
          'payment_webhook_events',
          'password_reset_tokens',
          'refresh_tokens',
          'meal_usages',
          'meal_usage_audits',
          'meal_recoveries',
          'support_tickets'
        ];
      BEGIN
        FOREACH tbl IN ARRAY tables LOOP
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
              EXECUTE format('REVOKE ALL ON TABLE public.%I FROM "anon"', tbl);
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
              EXECUTE format('REVOKE ALL ON TABLE public.%I FROM "authenticated"', tbl);
            END IF;
          END IF;
        END LOOP;
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
      DECLARE
        tbl text;
        tables text[] := ARRAY[
          'users',
          'payments',
          'subscriptions',
          'provider_earnings',
          'payment_webhook_events',
          'password_reset_tokens',
          'refresh_tokens',
          'meal_usages',
          'meal_usage_audits',
          'meal_recoveries',
          'support_tickets'
        ];
      BEGIN
        FOREACH tbl IN ARRAY tables LOOP
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
              EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO "anon"', tbl);
            END IF;
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
              EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO "authenticated"', tbl);
            END IF;
          END IF;
        END LOOP;
      END $$;
    `);

    // 2. Disable Row Level Security on all sensitive internal tables
    for (const table of this.sensitiveTables) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "${table}" DISABLE ROW LEVEL SECURITY;`,
      );
    }
  }
}
