/**
 * Platform-specific AI visibility estimates (Category 8).
 *
 * These are structural readiness scores, not live predictions.
 * Presented as: "Your structural readiness for [platform] citation is X/100."
 */

export interface PlatformVisibility {
  /** Platform identifier */
  platform: string;
  /** Platform display name */
  name: string;
  /** Structural readiness score 0-100 */
  readinessScore: number;
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
  /** Key signals that drive this platform's score */
  keySignals: PlatformSignal[];
  /** Top recommendations to improve for this platform */
  recommendations: string[];
}

export interface PlatformSignal {
  name: string;
  present: boolean;
  weight: number;
  description: string;
}

export interface PlatformVisibilityResult {
  platforms: PlatformVisibility[];
  overallReadiness: number;
  strongestPlatform: string;
  weakestPlatform: string;
}
