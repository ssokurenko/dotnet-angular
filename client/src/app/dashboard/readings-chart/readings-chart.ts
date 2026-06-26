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
  /** Noise floor (≈ sensor resolution) used when judging outliers. */
  floor: number;
  pick: (reading: SensorReading) => number;
}

/** Deviation (in σ) beyond which a point is treated as an anomaly. */
const ANOMALY_SIGMA = 2.5;
const ANOMALY_COLOR = '#ef4444';

/** Don't show the mean / flag anomalies until the window has enough samples. */
const MIN_READINGS_FOR_STATS = 10;

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
    temperature: { label: 'Temperature (°C)', color: '#dc2626', floor: 0.5, pick: (r) => r.temperature },
    humidity: { label: 'Humidity (%)', color: '#2563eb', floor: 1.0, pick: (r) => r.humidity },
    co2: { label: 'CO₂ (ppm)', color: '#6b7280', floor: 15, pick: (r) => r.co2Ppm }
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
            borderWidth: 2,
            order: 1
          },
          {
            label: 'Mean',
            data: [],
            borderColor: '#9ca3af',
            borderDash: [6, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            tension: 0,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { boxWidth: 16, font: { size: 11 } }
          }
        },
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
    const values = points.map(sensor.pick);

    // Robust "normal" baseline: mean of the inliers only, so a spike doesn't
    // drag the reference line toward itself.
    const inliers = this.inliers(values, sensor.floor);
    const normalMean = this.mean(inliers.length ? inliers : values);
    const spread = Math.max(this.stdDev(inliers), sensor.floor);

    const enoughData = values.length >= MIN_READINGS_FOR_STATS;
    const isAnomaly = (v: number) => enoughData && Math.abs(v - normalMean) / spread > ANOMALY_SIGMA;

    this.chart.data.labels = points.map((r) => `#${r.sequenceNumber}`);

    const [series, meanLine] = this.chart.data.datasets;
    series.label = sensor.label;
    series.data = values;
    series.borderColor = sensor.color;
    series.backgroundColor = `${sensor.color}20`;
    // Mark anomalous points (clearly above/below the normal line).
    series.pointRadius = values.map((v) => (isAnomaly(v) ? 5 : 2));
    series.pointBackgroundColor = values.map((v) => (isAnomaly(v) ? ANOMALY_COLOR : sensor.color));

    // Hide the mean line until there are enough readings to be meaningful.
    meanLine.data = enoughData ? values.map(() => normalMean) : [];

    this.chart.update();
  }

  private mean(values: number[]): number {
    return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
  }

  private stdDev(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }
    const mean = this.mean(values);
    const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }

  /** Values within ANOMALY_SIGMA of the mean (using the noise floor). */
  private inliers(values: number[], floor: number): number[] {
    const mean = this.mean(values);
    const spread = Math.max(this.stdDev(values), floor);
    return values.filter((v) => Math.abs(v - mean) / spread <= ANOMALY_SIGMA);
  }
}
