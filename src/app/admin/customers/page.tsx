import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';
import CustomersAdminShell from '@/app/_components/CustomersAdminShell';

export default async function AdminCustomersPage() {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin' && role !== 'supervisor') redirect('/');
  // Merge is admin-only on the API too — supervisor sees the list, no merge UI
  return <CustomersAdminShell canMerge={role === 'admin'} />;
}
