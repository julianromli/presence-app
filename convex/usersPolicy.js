export function isAdminManagedActivationAllowed(actorRole, targetRole) {
  if (actorRole === "superadmin") {
    return true;
  }
  if (actorRole !== "admin") {
    return false;
  }
  return targetRole === "karyawan" || targetRole === "device-qr";
}

export function isSelfDeactivation(actorId, targetId, nextActive) {
  return nextActive === false && String(actorId) === String(targetId);
}
