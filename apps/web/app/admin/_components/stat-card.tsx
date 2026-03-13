export function StatCard({
  title,
  value,
  change,
  subtitle,
}: {
  title: string;
  value: string | number;
  change?: { value: number; label: string };
  subtitle?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {change && (
        <p className={`mt-1 text-sm ${change.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {change.value >= 0 ? '+' : ''}{change.value}% {change.label}
        </p>
      )}
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}
