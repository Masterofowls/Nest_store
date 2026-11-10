import { BadRequestException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../db/database/database.service';
import { AdminDataService } from './admin-data.service';
import { AdminUsersService } from './admin-users.service';

const CATEGORY_ID = '00000000-0000-4000-8000-000000000001';
const SELLER_ID = '00000000-0000-4000-8000-000000000002';

function errorBody(error: unknown) {
  expect(error).toBeInstanceOf(BadRequestException);
  return (error as BadRequestException).getResponse();
}

describe('AdminDataService imports', () => {
  const transaction = jest.fn();
  const create = jest.fn();
  let service: AdminDataService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new AdminDataService(
      { db: { transaction } } as unknown as DatabaseService,
      { create } as unknown as AdminUsersService,
    );
  });

  it('rejects malformed CSV before touching the database', async () => {
    await expect(service.importProducts('name\n"open')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.importProducts('name,categoryId,sellerId,price,stockQuantity\n'),
    ).rejects.toThrow('CSV has no data rows');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('reports every invalid product row and imports nothing', async () => {
    const csv = [
      'name,categoryId,sellerId,price,stockQuantity',
      `Desk,${CATEGORY_ID},${SELLER_ID},10.00,1`,
      `,${CATEGORY_ID},${SELLER_ID},10.00,1`,
      `Lamp,${CATEGORY_ID},not-a-uuid,abc,1.5`,
    ].join('\n');
    const error: unknown = await service
      .importProducts(csv)
      .catch((e: unknown) => e);
    const body = errorBody(error) as { errors: { row: number }[] };
    expect(body.errors.map((entry) => entry.row)).toEqual([3, 4]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('inserts valid product rows in one transaction', async () => {
    const values = jest.fn<unknown, [unknown[]]>().mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]),
    });
    transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) =>
        callback({ insert: () => ({ values }) }),
    );
    const csv = [
      'name,categoryId,sellerId,price,stockQuantity,discountPercent,description',
      `Desk,${CATEGORY_ID},${SELLER_ID},10.00,1,15,Oak desk`,
      `Lamp,${CATEGORY_ID},${SELLER_ID},5.50,0,,`,
    ].join('\n');
    await expect(service.importProducts(csv)).resolves.toEqual({ created: 2 });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(values.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        name: 'Desk',
        stockQuantity: 1,
        discountPercent: 15,
        description: 'Oak desk',
      }),
      expect.objectContaining({ name: 'Lamp', stockQuantity: 0 }),
    ]);
  });

  it('rejects too many product rows', async () => {
    const row = `Desk,${CATEGORY_ID},${SELLER_ID},10.00,1`;
    const csv = [
      'name,categoryId,sellerId,price,stockQuantity',
      ...Array.from({ length: 1_001 }, () => row),
    ].join('\n');
    await expect(service.importProducts(csv)).rejects.toThrow('limit is 1000');
  });

  it('validates every user row before creating any account', async () => {
    const csv = [
      'name,email,password,isAdmin',
      'Ann,ann@example.test,long-enough,no',
      'Bob,bad-email,long-enough,',
      'Cid,ANN@example.test,long-enough,',
      'Dan,dan@example.test,long-enough,maybe',
    ].join('\n');
    const error: unknown = await service
      .importUsers(csv)
      .catch((e: unknown) => e);
    const body = errorBody(error) as { errors: { row: number }[] };
    expect(body.errors.map((entry) => entry.row)).toEqual([3, 4, 5]);
    expect(create).not.toHaveBeenCalled();
  });

  it('creates users and skips existing emails', async () => {
    create
      .mockResolvedValueOnce({ id: 'u1' })
      .mockRejectedValueOnce(new ConflictException('exists'));
    const csv = [
      'name,email,password,isAdmin',
      'Ann,ann@example.test,long-enough,true',
      'Bob,bob@example.test,long-enough,',
    ].join('\n');
    await expect(service.importUsers(csv)).resolves.toEqual({
      created: 1,
      skipped: [{ row: 3, message: 'bob@example.test already exists' }],
    });
    expect(create).toHaveBeenNthCalledWith(1, {
      name: 'Ann',
      email: 'ann@example.test',
      password: 'long-enough',
      isAdmin: true,
    });
  });

  it('stops on unexpected account errors', async () => {
    create.mockRejectedValue(new Error('database down'));
    await expect(
      service.importUsers(
        'name,email,password\nAnn,a@example.test,long-enough',
      ),
    ).rejects.toThrow('database down');
  });
});
