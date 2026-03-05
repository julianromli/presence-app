export function toInviteCodeView(invite) {
  if (!invite) {
    return null;
  }

  const normalized = {
    _id: invite._id,
    code: invite.code,
    isActive: invite.isActive,
    createdAt: invite.createdAt,
    updatedAt: invite.updatedAt,
  };

  if (typeof invite.lastRotatedAt === "number") {
    normalized.lastRotatedAt = invite.lastRotatedAt;
  }

  if (typeof invite.expiresAt === "number") {
    normalized.expiresAt = invite.expiresAt;
  }

  return normalized;
}
