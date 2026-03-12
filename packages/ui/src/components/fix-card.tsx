import React from 'react';

interface FixCardProps {
  description: string;
  points: number;
  layer: 'access' | 'understanding' | 'extractability';
  factorId: string;
  priority: number;
}

const LAYER_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  access: { bg: '#DBEAFE', text: '#1E40AF', label: 'Access' },
  understanding: { bg: '#E0E7FF', text: '#3730A3', label: 'Understanding' },
  extractability: { bg: '#FCE7F3', text: '#9D174D', label: 'Extractability' },
};

export function FixCard({ description, points, layer, factorId, priority }: FixCardProps) {
  const layerStyle = LAYER_COLORS[layer] ?? LAYER_COLORS.access;

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              backgroundColor: '#f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#6b7280',
              flexShrink: 0,
            }}
          >
            {priority}
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              padding: '2px 8px',
              borderRadius: 4,
              backgroundColor: layerStyle.bg,
              color: layerStyle.text,
              fontWeight: 500,
            }}
          >
            {layerStyle.label}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            Factor {factorId}
          </span>
        </div>
        <span
          style={{
            fontSize: '0.875rem',
            fontWeight: 700,
            color: '#059669',
            whiteSpace: 'nowrap',
          }}
        >
          +{points} pts
        </span>
      </div>
      <p style={{ fontSize: '0.875rem', color: '#374151', margin: 0, lineHeight: 1.5 }}>
        {description}
      </p>
    </div>
  );
}
