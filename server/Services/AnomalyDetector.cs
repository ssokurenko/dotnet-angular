using System.Globalization;
using Server.Models;

namespace Server.Services;

/// <summary>
/// Simple z-score anomaly detection.
/// For a new reading it computes the mean and standard deviation of each sensor type over the rolling window and
/// flags any value whose |z-score| exceeds <see cref="ZScoreThreshold"/>.
/// Pure logic — no state of its own.
/// </summary>
public class AnomalyDetector
{
    /// <summary>Flag a value when the absolute z-score exceeds this threshold.</summary>
    public const decimal ZScoreThreshold = 2.5m;

    /// <summary>Skip detection until the window has at least this many samples.</summary>
    public const int MinSampleSize = 5;

    /// <summary>
    /// Evaluates <paramref name="reading"/> against the statistical baseline
    /// <paramref name="window"/> (the recent readings). Returns 0–3 anomalies,
    /// one per offending sensor type. Pass the window that represents the
    /// baseline — e.g. the last <see cref="ReadingsStore.WindowSize"/> readings.
    /// </summary>
    public IReadOnlyList<Anomaly> Detect(SensorReading reading, IReadOnlyList<SensorReading> window)
    {
        ArgumentNullException.ThrowIfNull(reading);
        ArgumentNullException.ThrowIfNull(window);

        // Not enough samples to say anything meaningful yet.
        if (window.Count < MinSampleSize)
        {
            return Array.Empty<Anomaly>();
        }

        var anomalies = new List<Anomaly>(3);

        Evaluate(anomalies, "temperature", "Temperature", "°C",
            (double)reading.Temperature, window.Select(r => (double)r.Temperature));
        Evaluate(anomalies, "humidity", "Humidity", "%",
            (double)reading.Humidity, window.Select(r => (double)r.Humidity));
        Evaluate(anomalies, "co2", "CO₂", " ppm",
            reading.Co2Ppm, window.Select(r => (double)r.Co2Ppm));

        return anomalies;
    }

    private static void Evaluate(
        List<Anomaly> sink,
        string sensorType,
        string displayName,
        string unit,
        double value,
        IEnumerable<double> samples)
    {
        var data = samples as double[] ?? samples.ToArray();

        var mean = data.Average();
        var variance = data.Sum(v => (v - mean) * (v - mean)) / data.Length;
        var stdDev = Math.Sqrt(variance);

        // A flat window has no spread; nothing can be an outlier (avoids /0).
        if (stdDev == 0)
        {
            return;
        }

        var z = (value - mean) / stdDev;
        if (Math.Abs(z) <= (double)ZScoreThreshold)
        {
            return;
        }

        var direction = z > 0 ? "above" : "below";
        var reason = string.Format(
            CultureInfo.InvariantCulture,
            "{0} {1:0.#}{2} is {3:0.0}σ {4} mean",
            displayName, value, unit, Math.Abs(z), direction);

        sink.Add(new Anomaly
        {
            Id = Guid.NewGuid(),
            DetectedAt = DateTime.UtcNow,
            SensorType = sensorType,
            Value = (decimal)value,
            ZScore = Math.Round((decimal)z, 2),
            Reason = reason
        });
    }
}
