import { redirect } from 'next/navigation';
import { getTokenRole } from '@/lib/api';
import CustomerDetailShell from '@/app/_components/CustomerDetailShell';

export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const role = await getTokenRole();
  if (!role) redirect('/login');
  if (role !== 'admin' && role !== 'supervisor') redirect('/');
  const { id } = await params;
  return <CustomerDetailShell customerId={id} />;
}
