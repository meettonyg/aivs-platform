import React from 'react';

interface LayerChartProps {
  access: number;
  understanding: number;
  extractability: number;
}

const LAYERS = [
  { key: 'access', label: 'Layer 1: Access', color: '#3B82F6' },
  { key: 'understanding', label: 'Layer 2: Understanding', color: '#8B5CF6' },
  { key: 'extractability', label: 'Layer 3: Extractability', color: '#EC4899' },
] as const;

export function LayerChart({ access, understanding, extractability }: LayerChartProps) {
  const scores: Record<string, number> = { access, understanding, extractability };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {LAYERS.map((layer) => {
        const score = scores[layer.key] ?? 0;
        const percentage = Math.max(0, Math.min(100, score));
        return (
          <div key={layer.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151' }}>
                {layer.label}
              </span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: layer.color }}>
                {Math.round(score)}
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 24,
                backgroundColor: '#f3f4f6',
                borderRadius: 6,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: `${percentage}%`,
                  height: '100%',
                  backgroundColor: layer.color,
                  borderRadius: 6,
                  transition: 'width 0.5s ease-out',
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 8,
                }}
              >
                {percentage > 15 && (
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ffffff' }}>
                    {Math.round(score)}/100
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
