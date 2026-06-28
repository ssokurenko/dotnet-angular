import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { SensorDataService } from './sensor-data.service';
import { SensorReading } from '../models/sensor-reading';
import { Anomaly } from '../models/anomaly';

function reading(sequenceNumber: number): SensorReading {
  return {
    id: `r${sequenceNumber}`,
    sequenceNumber,
    timestamp: new Date().toISOString(),
    temperature: 22,
    humidity: 60,
    co2Ppm: 500,
  };
}

function anomaly(id: string): Anomaly {
  return {
    id,
    detectedAt: new Date().toISOString(),
    sensorType: 'temperature',
    value: 40,
    zScore: 3,
    reason: 'test',
  };
}

describe('SensorDataService', () => {
  let service: SensorDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SensorDataService);
  });

  it('keeps at most the last 20 readings in the window', async () => {
    for (let i = 1; i <= 25; i++) {
      service.setReading(reading(i));
    }

    const readings = await firstValueFrom(service.getReadings());
    expect(readings.length).toBe(20);
    expect(readings[0].sequenceNumber).toBe(6); // oldest kept
    expect(readings[readings.length - 1].sequenceNumber).toBe(25); // newest
  });

  it('keeps at most 10 anomalies, newest first', async () => {
    for (let i = 1; i <= 12; i++) {
      service.addAnomaly(anomaly(`a${i}`));
    }

    const anomalies = await firstValueFrom(service.getAnomalies());
    expect(anomalies.length).toBe(10);
    expect(anomalies[0].id).toBe('a12'); // most recent first
  });
});
