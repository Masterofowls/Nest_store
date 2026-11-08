import { ConfigService } from '@nestjs/config';
import type { Environment } from '../../config/env.schema';
import { DatabaseService } from './database.service';

describe('DatabaseService configuration and cleanup', () => {
  it('rejects missing database configuration', () => {
    const config = new ConfigService<Environment, true>();
    const get = jest.spyOn(config, 'get').mockReturnValue(undefined);

    try {
      expect(() => new DatabaseService(config)).toThrow('DATABASE_URL');
    } finally {
      get.mockRestore();
    }
  });

  it('closes the client with a five-second shutdown timeout', async () => {
    const config = new ConfigService<Environment, true>({
      DATABASE_URL: 'postgresql://localhost:5432/store_test',
    });
    const service = new DatabaseService(config);
    const end = jest.spyOn(service.db.$client, 'end');

    try {
      await service.onModuleDestroy();
      expect(end).toHaveBeenCalledWith({ timeout: 5 });
      expect(end).toHaveBeenCalledTimes(1);
    } finally {
      end.mockRestore();
      await service.onModuleDestroy();
    }
  });

  it('propagates client shutdown failures', async () => {
    const config = new ConfigService<Environment, true>({
      DATABASE_URL: 'postgresql://localhost:5432/store_test',
    });
    const service = new DatabaseService(config);
    const failure = new Error('Client shutdown failed');
    const end = jest
      .spyOn(service.db.$client, 'end')
      .mockRejectedValueOnce(failure);

    try {
      await expect(service.onModuleDestroy()).rejects.toBe(failure);
    } finally {
      end.mockRestore();
      await service.onModuleDestroy();
    }
  });
});

it('service initializes without connecting', async () => {
  const config = new ConfigService<Environment, true>({
    DATABASE_URL: 'postgresql://localhost:5432/store_test',
  });
  const service = new DatabaseService(config);

  try {
    expect(service.db).toBeDefined();
  } finally {
    await service.onModuleDestroy();
  }
});
