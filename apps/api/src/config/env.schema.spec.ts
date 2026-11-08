import { envSchema, validateEnvironment } from './env.schema';

const validAuthEnvironment = {
  BETTER_AUTH_SECRET: 'fake-test-secret-with-at-least-thirty-two-characters',
  BETTER_AUTH_URL: 'http://localhost:3000',
};

describe('validateEnvironment failures', () => {
  it.each([
    {},
    { DATABASE_URL: '' },
    { DATABASE_URL: 'not-a-url' },
    { DATABASE_URL: 'https://localhost:5432/store_test' },
  ])('throws a field-specific configuration error %#', (input) => {
    expect(() =>
      validateEnvironment({ ...validAuthEnvironment, ...input }),
    ).toThrow(/Invalid environment configuration: DATABASE_URL:/);
  });

  it('does not expose rejected connection strings in error messages', () => {
    const url = 'https://test-user:fake-test-password@localhost/store_test';
    let caught: unknown;

    try {
      validateEnvironment({
        ...validAuthEnvironment,
        DATABASE_URL: url,
      });
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    if (caught instanceof Error) {
      expect(caught.message).toContain('DATABASE_URL');
      expect(caught.message).not.toContain(url);
      expect(caught.message).not.toContain('fake-test-password');
    }
  });
});

describe('envSchema boundaries', () => {
  it.each([
    {},
    { DATABASE_URL: undefined },
    { DATABASE_URL: null },
    { DATABASE_URL: 123 },
    { DATABASE_URL: '' },
    { DATABASE_URL: 'not-a-url' },
    { DATABASE_URL: 'https://localhost:5432/store_test' },
    { DATABASE_URL: 'mysql://localhost:3306/store_test' },
  ])('rejects missing or invalid database configuration %#', (input) => {
    expect(
      envSchema.safeParse({ ...validAuthEnvironment, ...input }).success,
    ).toBe(false);
  });

  it.each(['postgres://', 'postgresql://'])(
    'accepts the %s protocol',
    (protocol) => {
      const input = {
        ...validAuthEnvironment,
        DATABASE_URL: `${protocol}localhost:5432/store_test`,
      };
      const result = envSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(input);
      }
    },
  );
});

it('test postgres url', () => {
  const input = {
    ...validAuthEnvironment,
    DATABASE_URL: 'postgresql://localhost:5432/store_test',
    PATH: 'test-path',
  };
  const result = envSchema.safeParse(input);

  expect(result.success).toBe(true);

  if (result.success) {
    expect(result.data).toEqual({
      DATABASE_URL: input.DATABASE_URL,
      ...validAuthEnvironment,
    });
  }
});

it('returns validated configuration without unrelated keys', () => {
  const input = {
    ...validAuthEnvironment,
    DATABASE_URL: 'postgresql://localhost:5432/store_test',
    PATH: 'test-path',
  };

  expect(validateEnvironment(input)).toEqual({
    DATABASE_URL: input.DATABASE_URL,
    ...validAuthEnvironment,
  });
});

describe('Better Auth configuration boundaries', () => {
  const validEnvironment = {
    ...validAuthEnvironment,
    DATABASE_URL: 'postgresql://localhost:5432/store_test',
  };

  it.each([undefined, null, '', 'short-secret', 123])(
    'rejects missing or short secrets %#',
    (secret) => {
      expect(
        envSchema.safeParse({
          ...validEnvironment,
          BETTER_AUTH_SECRET: secret,
        }).success,
      ).toBe(false);
    },
  );

  it.each([undefined, null, '', 'not-a-url', 'localhost:3000'])(
    'rejects invalid Better Auth URLs %#',
    (url) => {
      expect(
        envSchema.safeParse({
          ...validEnvironment,
          BETTER_AUTH_URL: url,
        }).success,
      ).toBe(false);
    },
  );
});
