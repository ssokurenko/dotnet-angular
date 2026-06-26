import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr';
import { SensorReading } from '../models/sensor-reading';
import { Anomaly } from '../models/anomaly';

/** Connection states surfaced on {@link SignalRService.connectionStatus$}. */
export type ConnectionStatus = 'disconnected' | 'connected' | 'reconnecting';

/** Relative hub URL — proxied to the .NET server in development. */
const HUB_URL = '/hubs/sensors';

/** How often to ping the server while connected. */
const HEARTBEAT_INTERVAL_MS = 5_000;

/**
 * Manages the SignalR hub connection and surfaces incoming readings, anomalies,
 * and connection status as RxJS streams. Server event names must
 * match the hub: `ReadingReceived`, `AnomalyDetected`, `Heartbeat`.
 */
@Injectable({ providedIn: 'root' })
export class SignalRService {
  public sensorReading$ = new Subject<SensorReading>();
  public anomaly$ = new Subject<Anomaly>();
  public connectionStatus$ = new BehaviorSubject<string>('disconnected');

  /** Emits the server time on each successful heartbeat ack. */
  public heartbeat$ = new Subject<string>();

  private connection?: HubConnection;
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  async connect(): Promise<void> {
    // Already connected or mid-connect — nothing to do.
    if (this.connection && this.connection.state !== HubConnectionState.Disconnected) {
      return;
    }

    const connection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('ReadingReceived', (reading: SensorReading) => this.sensorReading$.next(reading));
    connection.on('AnomalyDetected', (anomaly: Anomaly) => this.anomaly$.next(anomaly));

    connection.onreconnecting(() => this.connectionStatus$.next('reconnecting'));
    connection.onreconnected(() => {
      this.connectionStatus$.next('connected');
      this.startHeartbeat();
    });
    connection.onclose(() => {
      this.stopHeartbeat();
      this.connectionStatus$.next('disconnected');
    });

    this.connection = connection;

    try {
      await connection.start();
      this.connectionStatus$.next('connected');
      this.startHeartbeat();
    } catch (error) {
      this.connectionStatus$.next('disconnected');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.stopHeartbeat();
    if (this.connection) {
      await this.connection.stop();
      this.connection = undefined;
    }
    this.connectionStatus$.next('disconnected');
  }

  /** Invokes the hub `Heartbeat` and emits the ack. Failures are swallowed. */
  async sendHeartbeat(): Promise<void> {
    if (this.connection?.state !== HubConnectionState.Connected) {
      return;
    }
    try {
      const ack = await this.connection.invoke<{ serverTime: string }>('Heartbeat');
      this.heartbeat$.next(ack?.serverTime ?? new Date().toISOString());
    } catch {
      // Ignore — a real drop is handled by onreconnecting/onclose.
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    // Ping immediately so the UI can confirm liveness without waiting a full interval.
    void this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => void this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}
