/**
 * A flagged out-of-range value detected by z-score analysis.
 * Mirrors the server `Anomaly`.
 */
export interface Anomaly {
  id: string;
  detectedAt: string;
  sensorType: string;
  value: number;
  zScore: number;
  reason: string;
}
