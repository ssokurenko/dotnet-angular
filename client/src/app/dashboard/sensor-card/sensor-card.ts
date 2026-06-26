import { Component, Input, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { SensorStatus } from '../../services/sensor-data.service';

/**
 * A single sensor reading card (SPEC 2.1): label, current value with unit, and a
 * traffic-light status colour. The displayed value tweens smoothly toward each
 * new reading and pulses briefly on change.
 */
@Component({
  selector: 'app-sensor-card',
  imports: [DecimalPipe, MatCardModule],
  templateUrl: './sensor-card.html',
  styleUrl: './sensor-card.css'
})
export class SensorCard {
  @Input() label = '';
  @Input() unit = '';
  @Input() status: SensorStatus = 'green';
  @Input() fractionDigits = 0;

  /** Animated value shown in the template (glides toward the latest reading). */
  protected readonly displayValue = signal(0);

  private hasValue = false;
  private rafId?: number;

  @Input()
  set value(target: number) {
    if (!this.hasValue) {
      // First value arrives without a tween.
      this.hasValue = true;
      this.displayValue.set(target);
      return;
    }
    this.animateTo(target);
  }

  /** DecimalPipe format string, e.g. `1.1-1` for one decimal. */
  protected get format(): string {
    return `1.${this.fractionDigits}-${this.fractionDigits}`;
  }

  private animateTo(target: number): void {
    const start = this.displayValue();
    if (start === target) {
      return;
    }

    if (this.rafId !== undefined) {
      cancelAnimationFrame(this.rafId);
    }

    const duration = 400;
    const startTime = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      this.displayValue.set(start + (target - start) * eased);
      if (t < 1) {
        this.rafId = requestAnimationFrame(step);
      } else {
        this.displayValue.set(target);
        this.rafId = undefined;
      }
    };
    this.rafId = requestAnimationFrame(step);
  }
}
