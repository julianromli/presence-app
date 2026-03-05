export function isLastActiveSuperadminTransition({
  currentRole,
  currentActive,
  nextRole,
  nextActive,
  activeSuperadminCount,
}) {
  const removesSuperadmin =
    currentRole === "superadmin" &&
    currentActive &&
    (nextRole !== "superadmin" || nextActive === false);

  if (!removesSuperadmin) {
    return false;
  }

  return activeSuperadminCount <= 1;
}
