/**
 * Strip sensitive auth fields before serializing user objects in API responses.
 * @param {Record<string, unknown>|null|undefined} row
 */
export function toPublicAuthUser(row) {
  if (!row) return row;
  const { password_hash: _passwordHash, ...publicUser } = row;
  return publicUser;
}
