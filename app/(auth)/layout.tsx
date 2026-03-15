import { AppClerkProvider } from '@/components/providers/app-clerk-provider';

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppClerkProvider>{children}</AppClerkProvider>;
}
