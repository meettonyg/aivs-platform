'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AdminTable, type Column } from '../_components/admin-table';

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  memberships: { role: string; organization: { id: string; name: string; planTier: string } }[];
}

function UsersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<UserRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/users?${searchParams.toString()}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success) {
          setData(res.data);
          setPagination(res.pagination);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const changeRole = async (userId: string, newRole: string) => {
    setRoleChanging(userId);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) fetchUsers();
    setRoleChanging(null);
  };

  const impersonate = async (userId: string) => {
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) router.push('/dashboard');
  };

  const columns: Column<UserRow>[] = [
    { key: 'name', label: 'Name', sortable: true, render: (row) => row.name || '—' },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (row) => (
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
          row.role === 'superadmin' ? 'bg-red-100 text-red-700' :
          row.role === 'admin' ? 'bg-blue-100 text-blue-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {row.role}
        </span>
      ),
    },
    {
      key: 'memberships',
      label: 'Organizations',
      render: (row) =>
        row.memberships.length > 0
          ? row.memberships.map((m) => `${m.organization.name} (${m.organization.planTier})`).join(', ')
          : '—',
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <a
          href="/api/admin/users/export"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        {['', 'user', 'admin', 'superadmin'].map((r) => {
          const current = searchParams.get('role') ?? '';
          return (
            <button
              key={r}
              onClick={() => {
                const params = new URLSearchParams(searchParams.toString());
                if (r) params.set('role', r);
                else params.delete('role');
                params.set('page', '1');
                router.push(`/admin/users?${params.toString()}`);
              }}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                current === r ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {r || 'All Roles'}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center text-gray-500">Loading users...</div>
      ) : (
        <AdminTable
          columns={columns}
          data={data}
          pagination={pagination}
          searchPlaceholder="Search by name or email..."
          actions={(row) => {
            const user = row as unknown as UserRow;
            return (
              <div className="flex gap-2">
                <select
                  value={user.role}
                  onChange={(e) => changeRole(user.id, e.target.value)}
                  disabled={roleChanging === user.id}
                  className="rounded border px-2 py-1 text-xs"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="superadmin">superadmin</option>
                </select>
                <button
                  onClick={() => impersonate(user.id)}
                  className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200"
                >
                  Impersonate
                </button>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>}>
      <UsersContent />
    </Suspense>
  );
}
