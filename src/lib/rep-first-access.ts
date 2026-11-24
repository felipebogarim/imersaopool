export type RepFirstAccessState = {
  profileStatus: string | null | undefined;
  mustChangePassword: unknown;
  lastSignInAt: string | null | undefined;
};

/**
 * Contas novas usam `must_change_password`. Para contas legadas, que não têm essa marca,
 * o status pendente ou a ausência de qualquer login ainda exigem o cadastro da senha.
 */
export function needsRepFirstAccess({
  profileStatus,
  mustChangePassword,
  lastSignInAt,
}: RepFirstAccessState): boolean {
  if (mustChangePassword === false) return false;
  if (mustChangePassword === true) return true;
  return profileStatus === "pendente" || !lastSignInAt;
}
