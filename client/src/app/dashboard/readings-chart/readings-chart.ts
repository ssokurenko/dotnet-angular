import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import {
  CategoryScale,
  Chart,
  ChartConfiguration,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';
import { SensorReading } from '../../models/sensor-reading';
import { SensorDataService } from '../../services/sensor-data.service';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip
);

type SensorKey = 'temperature' | 'humidity' | 'co2';

interface SensorMeta {
  label: string;
  color: string;
  pick: (reading: SensorReading) => number;
}

/**
 * Line chart of the last 20 readings for one sensor (SPEC 2.1), with a toggle to
 * switch sensors. Driven by {@link SensorDataService.getReadings}.
 */
@Component({
  selector: 'app-readings-chart',
  imports: [MatCardModule, MatButtonToggleModule],
  templateUrl: './readings-chart.html',
  styleUrl: './readings-chart.css'
})
export class ReadingsChart implements AfterViewInit, OnDestroy {
  private readonly data = inject(SensorDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  protected readonly selected = signal<SensorKey>('temperature');

  private chart?: Chart<'line'>;
  private readings: SensorReading[] = [];

  private readonly sensors: Record<SensorKey, SensorMeta> = {
    temperature: { label: 'Temperature (°C)', color: '#dc2626', pick: (r) => r.temperature },
    humidity: { label: 'Humidity (%)', color: '#2563eb', pick: (r) => r.humidity },
    co2: { label: 'CO₂ (ppm)', color: '#6b7280', pick: (r) => r.co2Ppm }
  };

  ngAfterViewInit(): void {
    this.chart = new Chart(this.canvas().nativeElement, this.buildConfig());

    this.data
      .getReadings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((readings) => {
        this.readings = readings;
        this.refresh();
      });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  protected select(key: SensorKey): void {
    this.selected.set(key);
    this.refresh();
  }

  private buildConfig(): ChartConfiguration<'line'> {
    const sensor = this.sensors[this.selected()];
    return {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: sensor.label,
            data: [],
            borderColor: sensor.color,
            backgroundColor: `${sensor.color}20`,
            fill: true,
            tension: 0.3,
            pointRadius: 2,
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: false }
        }
      }
    };
  }

  private refresh(): void {
    if (!this.chart) {
      return;
    }
    const sensor = this.sensors[this.selected()];
    const points = this.readings.slice(-20);

    this.chart.data.labels = points.map((r) => `#${r.sequenceNumber}`);

    const series = this.chart.data.datasets[0];
    series.label = sensor.label;
    series.data = points.map(sensor.pick);
    series.borderColor = sensor.color;
    series.backgroundColor = `${sensor.color}20`;

    this.chart.update();
  }
}
