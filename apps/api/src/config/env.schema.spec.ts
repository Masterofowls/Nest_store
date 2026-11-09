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

  it.each(['https://*.example.test', 'https://%2a.example.test'])(
    'rejects a wildcard Better Auth hostname %s',
    (url) => {
      expect(
        envSchema.safeParse({ ...validEnvironment, BETTER_AUTH_URL: url })
          .success,
      ).toBe(false);
    },
  );

  it.each(['https://other.example.test', 'https://*.example.test', ' '])(
    'rejects Better Auth environment trust overrides',
    (origins) => {
      expect(() =>
        validateEnvironment({
          ...validEnvironment,
          BETTER_AUTH_TRUSTED_ORIGINS: origins,
        }),
      ).toThrow(
        /BETTER_AUTH_TRUSTED_ORIGINS: Use TRUSTED_FRONTEND_ORIGIN instead/,
      );
    },
  );

  it('accepts an empty Better Auth environment trust override', () => {
    expect(
      envSchema.safeParse({
        ...validEnvironment,
        BETTER_AUTH_TRUSTED_ORIGINS: '',
      }).success,
    ).toBe(true);
  });
});

describe('optional trusted frontend origin', () => {
  const environment = {
    ...validAuthEnvironment,
    DATABASE_URL: 'postgresql://localhost:5432/store_test',
  };

  it('accepts an absent origin', () => {
    expect(
      envSchema.parse(environment).TRUSTED_FRONTEND_ORIGIN,
    ).toBeUndefined();
  });

  it.each([
    ['http://localhost:3001', 'http://localhost:3001'],
    ['http://localhost:3001/', 'http://localhost:3001'],
    ['HTTPS://EXAMPLE.TEST:443/', 'https://example.test'],
    ['http://[::1]:3001/', 'http://[::1]:3001'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(
      envSchema.parse({ ...environment, TRUSTED_FRONTEND_ORIGIN: input })
        .TRUSTED_FRONTEND_ORIGIN,
    ).toBe(expected);
  });

  it.each([
    '',
    null,
    123,
    'not-a-url',
    'localhost:3001',
    'ftp://localhost:3001',
    'http://localhost:3001/shop',
    'http://localhost:3001//',
    'http://localhost:3001/shop/..',
    'http://localhost:3001/?',
    'http://localhost:3001/?query=value',
    'http://localhost:3001/#',
    'http://localhost:3001/#fragment',
    'http://user:password@localhost:3001',
    'http://@localhost:3001',
    'http://localhost:3001\\',
    'http://localhost:3001 ',
    'https://*.example.test',
    'https://%2a.example.test',
  ])('rejects invalid origin %#', (origin) => {
    expect(
      envSchema.safeParse({
        ...environment,
        TRUSTED_FRONTEND_ORIGIN: origin,
      }).success,
    ).toBe(false);
  });

  it('reports the field without exposing the rejected value', () => {
    const origin = 'http://user:password@localhost:3001';
    expect(() =>
      validateEnvironment({ ...environment, TRUSTED_FRONTEND_ORIGIN: origin }),
    ).toThrow(
      /^Invalid environment configuration: TRUSTED_FRONTEND_ORIGIN: TRUSTED_FRONTEND_ORIGIN must be/,
    );
    try {
      validateEnvironment({ ...environment, TRUSTED_FRONTEND_ORIGIN: origin });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      if (error instanceof Error) {
        expect(error.message).not.toContain(origin);
      }
    }
  });
});

describe('optional Supabase image storage', () => {
  const environment = {
    ...validAuthEnvironment,
    DATABASE_URL: 'postgresql://localhost:5432/store_test',
  };
  it('accepts a complete storage configuration', () => {
    expect(
      envSchema.safeParse({
        ...environment,
        SUPABASE_URL: 'https://storage.example.test',
        SUPABASE_SERVICE_ROLE_KEY: 'fake-storage-key-for-unit-tests',
        SUPABASE_STORAGE_BUCKET: 'product-images',
      }).success,
    ).toBe(true);
  });
  it.each([
    { SUPABASE_URL: 'https://storage.example.test' },
    { SUPABASE_SERVICE_ROLE_KEY: 'fake-storage-key-for-unit-tests' },
    {
      SUPABASE_URL: 'ftp://storage.example.test',
      SUPABASE_SERVICE_ROLE_KEY: 'fake-storage-key-for-unit-tests',
    },
    { SUPABASE_STORAGE_BUCKET: '../private' },
    { SUPABASE_SERVICE_ROLE_KEY: 'short' },
  ])('rejects incomplete or unsafe storage settings %#', (settings) => {
    expect(envSchema.safeParse({ ...environment, ...settings }).success).toBe(
      false,
    );
  });
});
