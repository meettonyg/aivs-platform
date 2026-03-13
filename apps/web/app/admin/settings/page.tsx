'use client';

import { useEffect, useState } from 'react';

interface PlatformSettings {
  id: string;
  defaultCrawlCredits: number;
  defaultRateLimit: number;
  featureFlags: Record<string, boolean>;
  maintenanceMode: boolean;
  systemEmailFrom: string | null;
  systemEmailReplyTo: string | null;
  updatedAt: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newFlagKey, setNewFlagKey] = useState('');

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((res) => { if (res.success) setSettings(res.data); })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) setSettings(data.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
    setSaving(false);
  };

  const toggleFlag = (key: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      featureFlags: { ...settings.featureFlags, [key]: !settings.featureFlags[key] },
    });
  };

  const addFlag = () => {
    if (!settings || !newFlagKey.trim()) return;
    setSettings({
      ...settings,
      featureFlags: { ...settings.featureFlags, [newFlagKey.trim()]: false },
    });
    setNewFlagKey('');
  };

  const removeFlag = (key: string) => {
    if (!settings) return;
    const flags = { ...settings.featureFlags };
    delete flags[key];
    setSettings({ ...settings, featureFlags: flags });
  };

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-500">Loading...</div>;
  if (!settings) return <div className="flex h-64 items-center justify-center text-red-500">Failed to load settings</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Saved!</span>}
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Default Limits */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Default Plan Limits</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-500">Default Crawl Credits</label>
            <input
              type="number"
              value={settings.defaultCrawlCredits}
              onChange={(e) => setSettings({ ...settings, defaultCrawlCredits: parseInt(e.target.value) || 0 })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Default Rate Limit (requests/min)</label>
            <input
              type="number"
              value={settings.defaultRateLimit}
              onChange={(e) => setSettings({ ...settings, defaultRateLimit: parseInt(e.target.value) || 0 })}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Maintenance Mode */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Maintenance Mode</h3>
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={settings.maintenanceMode}
            onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">Enable Maintenance Mode</p>
            <p className="text-xs text-gray-500">When enabled, non-admin users will see a maintenance page.</p>
          </div>
        </label>
      </div>

      {/* Feature Flags */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Feature Flags</h3>
        <div className="space-y-3">
          {Object.entries(settings.featureFlags).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-2">
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={() => toggleFlag(key)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm font-medium text-gray-700">{key}</span>
              </label>
              <button onClick={() => removeFlag(key)} className="text-xs text-red-600 hover:text-red-800">
                Remove
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              value={newFlagKey}
              onChange={(e) => setNewFlagKey(e.target.value)}
              placeholder="new_feature_flag"
              className="flex-1 rounded border px-3 py-2 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') addFlag(); }}
            />
            <button onClick={addFlag} className="rounded bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800">
              Add Flag
            </button>
          </div>
        </div>
      </div>

      {/* System Email */}
      <div className="rounded-lg border bg-white p-6">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">System Email Configuration</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-gray-500">From Email</label>
            <input
              type="email"
              value={settings.systemEmailFrom ?? ''}
              onChange={(e) => setSettings({ ...settings, systemEmailFrom: e.target.value || null })}
              placeholder="noreply@aivs.app"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500">Reply-To Email</label>
            <input
              type="email"
              value={settings.systemEmailReplyTo ?? ''}
              onChange={(e) => setSettings({ ...settings, systemEmailReplyTo: e.target.value || null })}
              placeholder="support@aivs.app"
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">Last updated: {new Date(settings.updatedAt).toLocaleString()}</p>
    </div>
  );
}
