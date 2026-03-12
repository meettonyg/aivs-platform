/**
 * Score change alert system (Factor 9.6).
 *
 * Detects score drops/improvements and generates alerts.
 * Designed to be called after each scan to check thresholds.
 */

export interface ScoreAlert {
  type: 'score_drop' | 'score_improvement' | 'tier_change' | 'factor_regression' | 'new_issue';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  url?: string;
  previousValue?: number;
  currentValue?: number;
  timestamp: string;
}

export interface AlertConfig {
  /** Minimum score drop to trigger alert */
  minScoreDrop: number;
  /** Minimum score improvement to notify */
  minScoreImprovement: number;
  /** Sub-score threshold — alert if any sub-score drops below this */
  subScoreFloor: number;
  /** Alert on tier changes */
  alertOnTierChange: boolean;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  minScoreDrop: 5,
  minScoreImprovement: 10,
  subScoreFloor: 20,
  alertOnTierChange: true,
};

export function checkScoreAlerts(
  current: {
    url: string;
    score: number;
    tier: string;
    subScores: Record<string, number>;
  },
  previous: {
    score: number;
    tier: string;
    subScores: Record<string, number>;
  } | null,
  config: AlertConfig = DEFAULT_ALERT_CONFIG,
): ScoreAlert[] {
  const alerts: ScoreAlert[] = [];
  const now = new Date().toISOString();

  if (!previous) return alerts;

  const scoreDelta = current.score - previous.score;

  // Overall score drop
  if (scoreDelta <= -config.minScoreDrop) {
    alerts.push({
      type: 'score_drop',
      severity: scoreDelta <= -15 ? 'critical' : 'warning',
      title: `Score dropped ${Math.abs(scoreDelta)} points`,
      message: `${current.url} score dropped from ${previous.score} to ${current.score}`,
      url: current.url,
      previousValue: previous.score,
      currentValue: current.score,
      timestamp: now,
    });
  }

  // Score improvement
  if (scoreDelta >= config.minScoreImprovement) {
    alerts.push({
      type: 'score_improvement',
      severity: 'info',
      title: `Score improved ${scoreDelta} points`,
      message: `${current.url} score improved from ${previous.score} to ${current.score}`,
      url: current.url,
      previousValue: previous.score,
      currentValue: current.score,
      timestamp: now,
    });
  }

  // Tier change
  if (config.alertOnTierChange && current.tier !== previous.tier) {
    const tierOrder = ['invisible', 'readable', 'extractable', 'authority'];
    const prevIdx = tierOrder.indexOf(previous.tier);
    const currIdx = tierOrder.indexOf(current.tier);
    const improved = currIdx > prevIdx;

    alerts.push({
      type: 'tier_change',
      severity: improved ? 'info' : 'critical',
      title: `Tier ${improved ? 'upgraded' : 'downgraded'}: ${previous.tier} → ${current.tier}`,
      message: `${current.url} moved from ${previous.tier} to ${current.tier}`,
      url: current.url,
      timestamp: now,
    });
  }

  // Individual sub-score regressions
  for (const [key, currentVal] of Object.entries(current.subScores)) {
    const prevVal = previous.subScores[key];
    if (prevVal === undefined) continue;

    const delta = currentVal - prevVal;

    // Sub-score dropped significantly
    if (delta <= -15) {
      alerts.push({
        type: 'factor_regression',
        severity: 'warning',
        title: `${key} score dropped ${Math.abs(delta)} points`,
        message: `${key} on ${current.url}: ${prevVal} → ${currentVal}`,
        url: current.url,
        previousValue: prevVal,
        currentValue: currentVal,
        timestamp: now,
      });
    }

    // Sub-score fell below floor
    if (currentVal < config.subScoreFloor && prevVal >= config.subScoreFloor) {
      alerts.push({
        type: 'new_issue',
        severity: 'warning',
        title: `${key} dropped below threshold (${config.subScoreFloor})`,
        message: `${key} on ${current.url} is now ${currentVal} (was ${prevVal})`,
        url: current.url,
        previousValue: prevVal,
        currentValue: currentVal,
        timestamp: now,
      });
    }
  }

  return alerts;
}
