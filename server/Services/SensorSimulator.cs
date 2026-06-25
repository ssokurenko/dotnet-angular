using Server.Models;

namespace Server.Services;

/// <summary>
/// Drives the "real-time streaming": generates a mock
/// greenhouse reading every <see cref="Interval"/> via a random walk around
/// sensible baselines, periodically injecting an out-of-range spike so anomaly
/// detection is visible. Each reading flows through the same
/// <see cref="ReadingIngestor"/> pipeline used by the POST endpoint.
/// </summary>
public class SensorSimulator(ReadingIngestor ingestor, ILogger<SensorSimulator> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(2);

    // Inject a spike every 4–5 readings so an anomaly appears roughly every 8–10s.
    private const int MinSpikeGap = 4;
    private const int MaxSpikeGap = 5;

    private readonly Random _random = new();

    // Current values for the random walk, seeded at the middle of each normal band.
    private double _temperature = 25.0; // °C,  normal 22–28
    private double _humidity = 62.0;    // %,   normal 55–70
    private double _co2 = 600.0;        // ppm, normal 400–800

    // Countdown (in readings) until the next forced spike. Start just past the
    // detector's 5-sample warmup so the first spike is actually evaluated.
    private int _readingsUntilSpike = 6;

    // Round-robin the spiked sensor so one sensor's window isn't poisoned by its
    // own repeated spikes (which would inflate its stdDev and hide later spikes).
    private int _nextSpikeSensor;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await ingestor.IngestAsync(NextReading(), stoppingToken);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to generate a simulated reading.");
                }
            }
        }
        catch (OperationCanceledException)
        {
            // Normal shutdown.
        }
    }

    private SensorReading NextReading()
    {
        // Gentle drift within the normal bands.
        _temperature = Drift(_temperature, 22, 28, 0.3);
        _humidity = Drift(_humidity, 55, 70, 0.6);
        _co2 = Drift(_co2, 400, 800, 15);

        var temperature = _temperature;
        var humidity = _humidity;
        var co2 = (int)Math.Round(_co2);

        // Periodically push one sensor well out of range to exercise detection,
        // rotating across sensors to keep each sensor's window clean.
        if (--_readingsUntilSpike <= 0)
        {
            switch (_nextSpikeSensor)
            {
                case 0: temperature += _random.Next(8, 15); break;   // heat spike
                case 1: humidity -= _random.Next(20, 30); break;     // dryness spike
                default: co2 += _random.Next(600, 1200); break;      // CO₂ spike
            }

            _nextSpikeSensor = (_nextSpikeSensor + 1) % 3;
            // MaxSpikeGap is inclusive here -> next gap is 4 or 5 readings (8–10s).
            _readingsUntilSpike = _random.Next(MinSpikeGap, MaxSpikeGap + 1);
        }

        return new SensorReading
        {
            // Id / SequenceNumber / Timestamp are assigned by the ingest pipeline.
            Temperature = Math.Round((decimal)temperature, 1),
            Humidity = Math.Round((decimal)humidity, 1),
            Co2Ppm = co2
        };
    }

    /// <summary>Random walk one step, clamped to [min, max].</summary>
    private double Drift(double current, double min, double max, double step)
    {
        var next = current + (_random.NextDouble() * 2 - 1) * step;
        return Math.Clamp(next, min, max);
    }
}
