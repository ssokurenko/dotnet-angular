import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { SensorReading } from '../models/sensor-reading';
import { Anomaly } from '../models/anomaly';
import { SignalRService } from './signalr.service';

/** Traffic-light status for a sensor value. */
export type SensorStatus = 'green' | 'yellow' | 'red';

/** Rolling window size for the chart (SPEC 2.1: last 20 readings). */
const MAX_READINGS = 20;

/** Anomalies retained for display (SPEC 2.1: last 10). */
const MAX_ANOMALIES = 10;

/**
 * Per-sensor thresholds. A value inside `green` is normal; inside the wider
 * `yellow` band (but outside green) is a warning; anything else is `red`.
 */
const THRESHOLDS: Record<string, { green: [number, number]; yellow: [number, number] }> = {
  temperature: { green: [18, 28], yellow: [14, 32] },
  humidity: { green: [50, 70], yellow: [40, 80] },
  co2: { green: [400, 1000], yellow: [300, 1400] }
};

/**
 * Central client state (SPEC 2.4): the current reading, the rolling readings
 * window for the chart, the recent anomalies, and the last-update time. Fed by
 * the SignalR live stream and seeded from REST via {@link hydrate}.
 */
@Injectable({ providedIn: 'root' })
export class SensorDataService {
  private readonly http = inject(HttpClient);
  private readonly signalR = inject(SignalRService);

  private readonly currentReading$ = new BehaviorSubject<SensorReading | null>(null);
  private readonly readings$ = new BehaviorSubject<SensorReading[]>([]);
  private readonly anomalies$ = new BehaviorSubject<Anomaly[]>([]);
  private readonly lastUpdated$ = new BehaviorSubject<Date | null>(null);

  constructor() {
    // Feed state from the live stream.
    this.signalR.sensorReading$.subscribe((reading) => this.setReading(reading));
    this.signalR.anomaly$.subscribe((anomaly) => this.addAnomaly(anomaly));
  }

  getCurrentReading(): Observable<SensorReading | null> {
    return this.currentReading$.asObservable();
  }

  getReadings(): Observable<SensorReading[]> {
    return this.readings$.asObservable();
  }

  getAnomalies(): Observable<Anomaly[]> {
    return this.anomalies$.asObservable();
  }

  getLastUpdated(): Observable<Date | null> {
    return this.lastUpdated$.asObservable();
  }

  /** Apply a new reading: set current, append to the capped window, stamp the time. */
  setReading(reading: SensorReading): void {
    console.log('[SensorData] reading received', reading);
    this.currentReading$.next(reading);

    const window = [...this.readings$.value, reading];
    if (window.length > MAX_READINGS) {
      window.splice(0, window.length - MAX_READINGS);
    }
    this.readings$.next(window);

    this.lastUpdated$.next(new Date());
  }

  /** Prepend an anomaly (newest first), capping the list. */
  addAnomaly(anomaly: Anomaly): void {
    this.anomalies$.next([anomaly, ...this.anomalies$.value].slice(0, MAX_ANOMALIES));
  }

  /** Seed initial state from REST so the UI has data before the stream warms up. */
  async hydrate(): Promise<void> {
    try {
      const latest = await firstValueFrom(
        this.http.get<SensorReading | null>('/api/readings/latest')
      );
      if (latest) {
        this.setReading(latest);
      }

      const anomalies = await firstValueFrom(this.http.get<Anomaly[]>('/api/anomalies'));
      this.anomalies$.next(anomalies.slice(0, MAX_ANOMALIES));
    } catch {
      // Non-fatal: the live stream will populate state once connected.
    }
  }

  /** Traffic-light status for a sensor value (used by the cards). */
  statusFor(sensorType: string, value: number): SensorStatus {
    const band = THRESHOLDS[sensorType];
    if (!band) {
      return 'green';
    }
    const [greenLow, greenHigh] = band.green;
    const [yellowLow, yellowHigh] = band.yellow;

    if (value >= greenLow && value <= greenHigh) {
      return 'green';
    }
    if (value >= yellowLow && value <= yellowHigh) {
      return 'yellow';
    }
    return 'red';
  }
}
