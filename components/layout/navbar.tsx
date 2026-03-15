import { auth } from '@clerk/nextjs/server';

import { NavbarClient } from './navbar-client';

const Navbar = async () => {
  const session = await auth();
  const isSignedIn = Boolean(session.userId);

  return <NavbarClient isSignedIn={isSignedIn} role={null} />;
};

export default Navbar;
