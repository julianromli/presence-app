import { getCurrentSession } from '@/lib/auth';

import { NavbarClient } from './navbar-client';

const Navbar = async () => {
  const session = await getCurrentSession();
  const isSignedIn = Boolean(session.userId);

  return <NavbarClient isSignedIn={isSignedIn} role={session.role} />;
};

export default Navbar;
