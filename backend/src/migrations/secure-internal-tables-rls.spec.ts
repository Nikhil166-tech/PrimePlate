import { SecureInternalTablesRls1786460000000 } from './1786460000000-SecureInternalTablesRls';

describe('SecureInternalTablesRls1786460000000 Migration', () => {
  let migration: SecureInternalTablesRls1786460000000;

  beforeEach(() => {
    migration = new SecureInternalTablesRls1786460000000();
  });

  it('should have correct name and methods', () => {
    expect(migration.name).toBe('SecureInternalTablesRls1786460000000');
    expect(typeof migration.up).toBe('function');
    expect(typeof migration.down).toBe('function');
  });

  it('should execute PostgreSQL RLS enable queries and revoke anon/authenticated access in up()', async () => {
    const executedQueries: string[] = [];
    const mockQueryRunner: any = {
      connection: {
        options: {
          type: 'postgres',
        },
      },
      query: jest.fn(async (sql: string) => {
        executedQueries.push(sql);
      }),
    };

    await migration.up(mockQueryRunner);

    // 11 tables + 1 DO block = 12 query calls
    expect(mockQueryRunner.query).toHaveBeenCalledTimes(12);

    const sensitiveTables = [
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

    for (const table of sensitiveTables) {
      expect(
        executedQueries.some((q) =>
          q.includes(
            `ALTER TABLE IF EXISTS "${table}" ENABLE ROW LEVEL SECURITY;`,
          ),
        ),
      ).toBe(true);
    }

    const doBlock = executedQueries[executedQueries.length - 1];
    expect(doBlock).toContain('REVOKE ALL ON TABLE public.%I FROM "anon"');
    expect(doBlock).toContain(
      'REVOKE ALL ON TABLE public.%I FROM "authenticated"',
    );
  });

  it('should execute PostgreSQL RLS disable queries and restore access in down()', async () => {
    const executedQueries: string[] = [];
    const mockQueryRunner: any = {
      connection: {
        options: {
          type: 'postgres',
        },
      },
      query: jest.fn(async (sql: string) => {
        executedQueries.push(sql);
      }),
    };

    await migration.down(mockQueryRunner);

    expect(mockQueryRunner.query).toHaveBeenCalledTimes(12);
    const doBlock = executedQueries[0];
    expect(doBlock).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO "anon"',
    );
    expect(doBlock).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO "authenticated"',
    );
  });

  it('should no-op if connection is not postgres (e.g. SQLite)', async () => {
    const mockQueryRunner: any = {
      connection: {
        options: {
          type: 'better-sqlite3',
        },
      },
      query: jest.fn(),
    };

    await migration.up(mockQueryRunner);
    await migration.down(mockQueryRunner);

    expect(mockQueryRunner.query).not.toHaveBeenCalled();
  });
});
