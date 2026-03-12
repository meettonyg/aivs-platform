import React from 'react';

interface TierBadgeProps {
  tierKey: string;
  tierLabel: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: { fontSize: '0.75rem', padding: '2px 8px' },
  md: { fontSize: '0.875rem', padding: '4px 12px' },
  lg: { fontSize: '1rem', padding: '6px 16px' },
};

export function TierBadge({ tierLabel, color, size = 'md' }: TierBadgeProps) {
  const style = sizeStyles[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '9999px',
        fontWeight: 600,
        backgroundColor: `${color}20`,
        color,
        ...style,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          marginRight: 6,
          flexShrink: 0,
        }}
      />
      {tierLabel}
    </span>
  );
}
