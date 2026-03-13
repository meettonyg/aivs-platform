import Link from 'next/link';
import { requireSuperAdmin } from '@/lib/admin';

const navItems = [
  { href: '/admin', label: 'Overview', icon: '◉' },
  { href: '/admin/users', label: 'Users', icon: '◎' },
  { href: '/admin/organizations', label: 'Organizations', icon: '◈' },
  { href: '/admin/scans', label: 'Scans', icon: '◇' },
  { href: '/admin/crawl-jobs', label: 'Crawl Jobs', icon: '◆' },
  { href: '/admin/billing', label: 'Billing', icon: '◖' },
  { href: '/admin/api-keys', label: 'API Keys', icon: '◗' },
  { href: '/admin/alerts', label: 'Alerts', icon: '◐' },
  { href: '/admin/settings', label: 'Settings', icon: '◑' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSuperAdmin();
  const user = session.user as { email?: string | null; role?: string; isImpersonating?: boolean };

  return (
    <div className="flex min-h-screen">
      {/* Dark sidebar */}
      <aside className="w-64 bg-gray-900 text-gray-100">
        <div className="flex h-16 items-center border-b border-gray-700 px-6">
          <Link href="/admin" className="text-lg font-bold text-white">
            AIVS <span className="text-xs font-normal text-gray-400">Admin</span>
          </Link>
        </div>
        <nav className="space-y-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-gray-700 p-4">
          <Link
            href="/dashboard"
            className="block rounded-lg px-3 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            &larr; Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col bg-gray-50">
        {user.isImpersonating && (
          <div className="flex items-center justify-between bg-amber-500 px-6 py-2 text-sm font-medium text-white">
            <span>You are impersonating a user. Actions will be performed as that user.</span>
            <form action="/api/admin/impersonate" method="POST">
              <input type="hidden" name="_method" value="DELETE" />
              <button className="rounded bg-amber-600 px-3 py-1 text-xs font-semibold hover:bg-amber-700">
                Stop Impersonating
              </button>
            </form>
          </div>
        )}
        <header className="flex h-16 items-center justify-between border-b bg-white px-6">
          <h2 className="font-semibold text-gray-900">Admin Panel</h2>
          <div className="flex items-center gap-4">
            <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700">superadmin</span>
            <span className="text-sm text-gray-600">{user.email}</span>
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
