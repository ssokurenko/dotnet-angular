import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { AsyncPipe, DatePipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SensorDataService } from '../../services/sensor-data.service';

/**
 * Recent anomalies list (SPEC 2.1): last 10, newest first, each showing the
 * sensor type, value, reason, and timestamp. Auto-scrolls to the newest item.
 */
@Component({
  selector: 'app-anomaly-list',
  imports: [AsyncPipe, DatePipe, DecimalPipe, MatCardModule, MatIconModule],
  templateUrl: './anomaly-list.html',
  styleUrl: './anomaly-list.css'
})
export class AnomalyList {
  private readonly data = inject(SensorDataService);

  protected readonly anomalies$ = this.data.getAnomalies();

  private readonly listRef = viewChild<ElementRef<HTMLElement>>('list');

  constructor() {
    // Keep the newest (top) item in view as anomalies arrive.
    this.anomalies$.pipe(takeUntilDestroyed()).subscribe(() => {
      requestAnimationFrame(() => {
        const el = this.listRef()?.nativeElement;
        if (el) {
          el.scrollTop = 0;
        }
      });
    });
  }

  protected iconFor(sensorType: string): string {
    switch (sensorType) {
      case 'temperature':
        return 'thermostat';
      case 'humidity':
        return 'water_drop';
      case 'co2':
        return 'air';
      default:
        return 'warning';
    }
  }

  protected labelFor(sensorType: string): string {
    switch (sensorType) {
      case 'temperature':
        return 'Temperature';
      case 'humidity':
        return 'Humidity';
      case 'co2':
        return 'CO₂';
      default:
        return sensorType;
    }
  }

  protected unitFor(sensorType: string): string {
    switch (sensorType) {
      case 'temperature':
        return '°C';
      case 'humidity':
        return '%';
      case 'co2':
        return 'ppm';
      default:
        return '';
    }
  }
}
