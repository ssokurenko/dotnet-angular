using Server.Models;
using Server.Services;

namespace Server.Tests;

public class AnomalyDetectorTests
{
    private readonly AnomalyDetector _detector = new();

    private static SensorReading Reading(decimal temperature, decimal humidity = 60m, int co2 = 500) =>
        new() { Temperature = temperature, Humidity = humidity, Co2Ppm = co2 };

    // A stable baseline window (temperature ~22 °C, constant humidity/CO₂).
    private static List<SensorReading> StableWindow() =>
        Enumerable.Range(0, 10).Select(i => Reading(22m + (i % 2) * 0.1m)).ToList();

    [Fact]
    public void Detect_flags_a_clear_spike()
    {
        var anomalies = _detector.Detect(Reading(40m), StableWindow());

        var temperature = Assert.Single(anomalies, a => a.SensorType == "temperature");
        Assert.True(Math.Abs(temperature.ZScore) > AnomalyDetector.ZScoreThreshold);
    }

    [Fact]
    public void Detect_ignores_a_normal_reading()
    {
        // A reading right around the baseline mean — not an anomaly.
        var anomalies = _detector.Detect(Reading(22.05m), StableWindow());

        Assert.Empty(anomalies);
    }
}
