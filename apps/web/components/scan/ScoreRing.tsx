import { getTier } from '@aivs/types';

export function ScoreRing({ score, size = 140 }: { score: number; size?: number }) {
  const tier = getTier(score);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tier.color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-3xl font-extrabold text-gray-900">{score}</span>
        <span className="text-sm text-gray-400">/100</span>
        <p className="text-xs font-medium" style={{ color: tier.color }}>{tier.label}</p>
      </div>
    </div>
  );
}
