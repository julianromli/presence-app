import { redirect } from 'next/navigation';

export default function DashboardUsersAddRedirectPage() {
  redirect('/dashboard/users');
}