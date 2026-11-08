import { testEnvSchema } from './test-env.schema';

describe('test database target boundaries', () => {
  it.each([
    'postgresql://localhost/store_test',
    'postgres://127.0.0.1:5432/store_test',
    'postgresql://test_user:fake_test_password@localhost:5432/store_test',
  ])('accepts an explicit local test target %#', (url) => {
    const input = { TEST_DATABASE_URL: url };
    const result = testEnvSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(input);
    }
  });

  it.each([
    'not-a-url',
    '',
    'postgresql://remote.example:5432/store_test',
    'postgresql://localhost.remote.example:5432/store_test',
    'postgresql://localhost:5433/store_test',
    'postgresql://localhost:5432/postgres',
    'postgresql://localhost:5432/store_test_other',
    'postgresql://localhost:5432/',
    'postgresql://localhost:5432/store_test?host=remote.example',
    'postgresql://localhost:5432/store_test#fragment',
    'https://localhost:5432/store_test',
    'mysql://localhost:5432/store_test',
  ])('rejects invalid or unsafe test targets without throwing %#', (url) => {
    expect(testEnvSchema.safeParse({ TEST_DATABASE_URL: url }).success).toBe(
      false,
    );
  });

  it.each([
    {},
    { TEST_DATABASE_URL: undefined },
    { TEST_DATABASE_URL: null },
    { TEST_DATABASE_URL: 123 },
    { DATABASE_URL: 'postgresql://localhost:5432/store_test' },
  ])(
    'requires TEST_DATABASE_URL and never falls back to DATABASE_URL %#',
    (input) => {
      expect(testEnvSchema.safeParse(input).success).toBe(false);
    },
  );
});

describe('test local db', () => {
  it('test local url pass', () => {
    const input = {
      TEST_DATABASE_URL: 'postgresql://localhost:5432/store_test',
    };
    const result = testEnvSchema.safeParse(input);

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.data).toEqual(input);
    }
  });
});
