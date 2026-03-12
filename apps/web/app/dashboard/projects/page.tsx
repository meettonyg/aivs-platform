'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  domain: string;
  name: string;
  latestScore: number | null;
  latestTier: string | null;
  lastScannedAt: string | null;
}

const TIER_COLORS: Record<string, string> = {
  authority: 'bg-green-100 text-green-800',
  extractable: 'bg-blue-100 text-blue-800',
  readable: 'bg-yellow-100 text-yellow-800',
  invisible: 'bg-red-100 text-red-800',
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [domain, setDomain] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => { if (d.success) setProjects(d.data); });
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, name }),
    });

    const data = await res.json();
    if (data.success) {
      setProjects((prev) => [{ ...data.data, latestScore: null, latestTier: null, lastScannedAt: null }, ...prev]);
      setShowCreate(false);
      setDomain('');
      setName('');
    } else {
      setError(data.error?.message ?? 'Failed to create project');
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Project
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-lg border bg-white p-4">
          <form onSubmit={handleCreate} className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="domain.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              required
              className="rounded-lg border px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {projects.length > 0 ? (
        <div className="overflow-hidden rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Domain</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">Last Scanned</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{project.name}</td>
                  <td className="px-4 py-3 text-gray-600">{project.domain}</td>
                  <td className="px-4 py-3">
                    {project.latestScore !== null ? (
                      <span className="font-semibold">{project.latestScore}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {project.latestTier ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[project.latestTier] ?? ''}`}>
                        {project.latestTier}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {project.lastScannedAt
                      ? new Date(project.lastScannedAt).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/scan/${project.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      View Scans
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-8 text-center text-gray-500">
          No projects yet. Click "Add Project" to get started.
        </div>
      )}
    </div>
  );
}
