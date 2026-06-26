import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { Observable, combineLatest, fromEvent, map, merge, shareReplay, startWith } from 'rxjs';
import { SignalRService } from '../services/signalr.service';
import { SensorDataService, SensorStatus } from '../services/sensor-data.service';
import { SensorCard } from './sensor-card/sensor-card';

/**
 * Single-page dashboard shell (SPEC 2.1): header with title, LIVE/OFFLINE badge,
 * and last-update time; body hosts the sensor cards, anomaly list, and chart.
 * Owns the connection lifecycle (hydrate + connect on init, disconnect on destroy).
 */
@Component({
  selector: 'app-dashboard',
  imports: [AsyncPipe, DatePipe, MatToolbarModule, MatChipsModule, MatIconModule, SensorCard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, OnDestroy {
  private readonly signalR = inject(SignalRService);
  private readonly data = inject(SensorDataService);

  protected readonly currentReading$ = this.data.getCurrentReading();
  protected readonly lastUpdated$ = this.data.getLastUpdated();

  /** Browser online/offline state (SPEC: badge based on browser API). */
  private readonly online$ = merge(
    fromEvent(window, 'online').pipe(map(() => true)),
    fromEvent(window, 'offline').pipe(map(() => false))
  ).pipe(startWith(navigator.onLine));

  /** LIVE only when the browser is online *and* the hub is connected. */
  protected readonly isLive$: Observable<boolean> = combineLatest([
    this.online$,
    this.signalR.connectionStatus$
  ]).pipe(map(([online, status]) => online && status === 'connected'));

  /** False until the first heartbeat ack arrives — show a spinner until then. */
  protected readonly hasHeartbeat$: Observable<boolean> = this.signalR.heartbeat$.pipe(
    map(() => true),
    startWith(false),
    shareReplay(1)
  );

  /** Traffic-light status for a sensor value (delegates to the state service). */
  protected statusFor(sensorType: string, value: number): SensorStatus {
    return this.data.statusFor(sensorType, value);
  }

  async ngOnInit(): Promise<void> {
    await this.data.hydrate();
    await this.signalR.connect();
  }

  async ngOnDestroy(): Promise<void> {
    await this.signalR.disconnect();
  }
}
