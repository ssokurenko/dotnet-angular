using Server.Models;

namespace Server.Services;

/// <summary>
/// Thread-safe in-memory store for the greenhouse demo. Holds the rolling
/// window of recent readings (used for anomaly detection and the chart) and a
/// capped list of recent anomalies. There is no persistence — state is lost on
/// restart, which is intentional for the demo.
/// </summary>
public class ReadingsStore
{
    /// <summary>Number of readings kept for the rolling window / chart.</summary>
    public const int WindowSize = 20;

    /// <summary>Maximum number of anomalies retained in memory.</summary>
    public const int MaxAnomalies = 20;

    private readonly object _gate = new();
    private readonly LinkedList<SensorReading> _readings = new();
    private readonly LinkedList<Anomaly> _anomalies = new();
    private long _sequence;

    /// <summary>Returns the next monotonic sequence number.</summary>
    public long NextSequence() => Interlocked.Increment(ref _sequence);

    /// <summary>Adds a reading, evicting the oldest once the window is full.</summary>
    public void Add(SensorReading reading)
    {
        ArgumentNullException.ThrowIfNull(reading);

        lock (_gate)
        {
            _readings.AddLast(reading);
            while (_readings.Count > WindowSize)
            {
                _readings.RemoveFirst();
            }
        }
    }

    /// <summary>Returns the most recent reading, or null when empty.</summary>
    public SensorReading? GetLatest()
    {
        lock (_gate)
        {
            return _readings.Last?.Value;
        }
    }

    /// <summary>Returns a snapshot of the current window, oldest first (≤ <see cref="WindowSize"/>).</summary>
    public IReadOnlyList<SensorReading> GetWindow()
    {
        lock (_gate)
        {
            return _readings.ToArray();
        }
    }

    /// <summary>Records an anomaly, capping the retained list at <see cref="MaxAnomalies"/>.</summary>
    public void AddAnomaly(Anomaly anomaly)
    {
        ArgumentNullException.ThrowIfNull(anomaly);

        lock (_gate)
        {
            _anomalies.AddLast(anomaly);
            while (_anomalies.Count > MaxAnomalies)
            {
                _anomalies.RemoveFirst();
            }
        }
    }

    /// <summary>Returns the most recent anomalies, newest first (at most <paramref name="take"/>).</summary>
    public IReadOnlyList<Anomaly> GetRecentAnomalies(int take)
    {
        if (take <= 0)
        {
            return Array.Empty<Anomaly>();
        }

        lock (_gate)
        {
            return _anomalies.Reverse().Take(take).ToArray();
        }
    }
}
