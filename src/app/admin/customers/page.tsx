import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';
import CustomersAdminShell from '@/app/_components/CustomersAdminShell';

export default async function AdminCustomersPage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin' && role !== 'supervisor') redirect('/');
  // Merge + add are admin-only on the API too — supervisor sees the list, no merge/add UI
  const isAdmin = role === 'admin';
  return <CustomersAdminShell canMerge={isAdmin} canAdd={isAdmin} />;
}
