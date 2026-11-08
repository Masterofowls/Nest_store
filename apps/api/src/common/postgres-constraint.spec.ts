import { isPostgresConstraint } from './postgres-constraint';

describe('PostgreSQL constraint identification', () => {
  it('finds a wrapped driver constraint', () => {
    expect(
      isPostgresConstraint(
        {
          cause: { code: '23505', constraint_name: 'unique_store' },
        },
        '23505',
        'unique_store',
      ),
    ).toBe(true);
  });

  it.each([
    null,
    undefined,
    'error',
    {},
    { code: '23503', constraint_name: 'unique_store' },
  ])('does not classify unrelated errors %j', (error) => {
    expect(isPostgresConstraint(error, '23505', 'unique_store')).toBe(false);
  });

  it('bounds cyclic cause traversal', () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(isPostgresConstraint(error, '23505', 'unique_store')).toBe(false);
  });
});
