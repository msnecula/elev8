import { describe, it, expect } from 'vitest';
import postgres from 'postgres';
import { toTransactionPoolerUrl } from '@/server/db/poolerUrl';

const SESSION_URL = 'postgresql://postgres.abcdefghijkl:s3cret@aws-1-us-east-1.pooler.supabase.com:5432/postgres';

describe('toTransactionPoolerUrl', () => {
  it('switches the Supabase session pooler (:5432) to transaction mode (:6543)', () => {
    expect(toTransactionPoolerUrl(SESSION_URL)).toBe(
      'postgresql://postgres.abcdefghijkl:s3cret@aws-1-us-east-1.pooler.supabase.com:6543/postgres',
    );
  });

  it('treats a pooler URL without a port as session mode', () => {
    const url = 'postgres://postgres.abcdefghijkl:pw@aws-0-us-west-1.pooler.supabase.com/postgres';
    expect(toTransactionPoolerUrl(url)).toBe(
      'postgres://postgres.abcdefghijkl:pw@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
    );
  });

  it('leaves a transaction pooler URL unchanged', () => {
    const url = 'postgresql://postgres.abcdefghijkl:pw@aws-1-us-east-1.pooler.supabase.com:6543/postgres';
    expect(toTransactionPoolerUrl(url)).toBe(url);
  });

  it('leaves direct and non-Supabase connections unchanged', () => {
    const direct = 'postgresql://postgres:pw@db.abcdefghijkl.supabase.co:5432/postgres';
    const local = 'postgresql://postgres:pw@localhost:5432/elev8';
    expect(toTransactionPoolerUrl(direct)).toBe(direct);
    expect(toTransactionPoolerUrl(local)).toBe(local);
  });

  it('keeps an encoded password and query params intact for postgres.js', () => {
    const url = 'postgresql://postgres.abcdefghijkl:p%40ss%2Fw%23rd@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require';
    const converted = toTransactionPoolerUrl(url);
    const { options } = postgres(converted);

    expect(options.host).toEqual(['aws-1-us-east-1.pooler.supabase.com']);
    expect(options.port).toEqual([6543]);
    expect(options.user).toBe('postgres.abcdefghijkl');
    expect(options.pass).toBe('p@ss/w#rd');
    expect(options.database).toBe('postgres');
    expect(options.ssl).toBe('require');
  });

  it('returns unparseable input unchanged', () => {
    expect(toTransactionPoolerUrl('not a url')).toBe('not a url');
  });
});
