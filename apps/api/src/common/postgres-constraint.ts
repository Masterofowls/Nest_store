export function isPostgresConstraint(
  error: unknown,
  code: string,
  constraint: string,
): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4; depth++) {
    if (typeof current !== 'object' || current === null) {
      return false;
    }
    if (
      'code' in current &&
      current.code === code &&
      'constraint_name' in current &&
      current.constraint_name === constraint
    ) {
      return true;
    }
    current = 'cause' in current ? current.cause : undefined;
  }
  return false;
}
