export function listActiveInviteCodeIds(inviteCodes) {
  return inviteCodes.filter((item) => item.isActive).map((item) => item._id);
}
