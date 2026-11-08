import { deleteUserSchema, updateUserSchema } from './user.schema';

describe('Own account request schemas', () => {
  it('accepts a bounded nonempty name', () => {
    expect(updateUserSchema.parse({ name: ' Renamed buyer ' })).toEqual({
      name: 'Renamed buyer',
    });
    expect(updateUserSchema.safeParse({ name: 'x'.repeat(100) }).success).toBe(
      true,
    );
    expect(updateUserSchema.safeParse({ name: 'x'.repeat(101) }).success).toBe(
      false,
    );
    expect(updateUserSchema.safeParse({ name: '  ' }).success).toBe(false);
  });

  it.each(['image', 'email', 'emailVerified', 'isAdmin', 'id'])(
    'rejects private or deferred account field %s',
    (field) => {
      expect(
        updateUserSchema.safeParse({ name: 'Buyer', [field]: 'changed' })
          .success,
      ).toBe(false);
    },
  );

  it('does not accept an account ID for deletion', () => {
    expect(deleteUserSchema.parse(undefined)).toBeUndefined();
    expect(deleteUserSchema.safeParse({ id: 'another-user' }).success).toBe(
      false,
    );
  });
});
