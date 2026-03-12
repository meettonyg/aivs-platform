import React from 'react';

interface SubScoreBarProps {
  label: string;
  score: number;
  maxScore?: number;
  color?: string;
}

export function SubScoreBar({
  label,
  score,
  maxScore = 100,
  color = '#3B82F6',
}: SubScoreBarProps) {
  const percentage = Math.max(0, Math.min(100, (score / maxScore) * 100));

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>
          {label}
        </span>
        <span style={{ fontSize: '0.875rem', fontWeight: 600, color }}>
          {Math.round(score)}/{maxScore}
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: 8,
          backgroundColor: '#e5e7eb',
          borderRadius: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            borderRadius: 4,
            transition: 'width 0.4s ease-out',
          }}
        />
      </div>
    </div>
  );
}
