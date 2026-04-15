// Force all admin pages to be dynamically rendered — prevents bfcache from
// serving a stale cached page after logout when a user presses the back button.
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
