/**
 * A single environmental sample from the greenhouse sensor.
 * Mirrors the server `SensorReading` (decimals are serialized as JSON numbers).
 */
export interface SensorReading {
  id: string;
  sequenceNumber: number;
  timestamp: string;
  temperature: number;
  humidity: number;
  co2Ppm: number;
}
