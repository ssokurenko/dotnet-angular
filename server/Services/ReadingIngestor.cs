using Server.Models;

namespace Server.Services;

/// <summary>
/// Shared ingest pipeline used by both the POST endpoint and the
/// sensor simulator: assign defaults, detect anomalies against the
/// current baseline, store the reading and any anomalies, then broadcast.
/// </summary>
public class ReadingIngestor(
    ReadingsStore store,
    AnomalyDetector detector,
    IReadingBroadcaster broadcaster)
{
    /// <summary>
    /// Runs one reading through the full pipeline and returns the stored reading
    /// (with any server-assigned fields populated).
    /// </summary>
    public async Task<SensorReading> IngestAsync(SensorReading reading, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(reading);

        // Fill in anything the caller did not supply.
        if (reading.Id == Guid.Empty)
        {
            reading.Id = Guid.NewGuid();
        }

        if (reading.SequenceNumber == 0)
        {
            reading.SequenceNumber = store.NextSequence();
        }

        if (reading.Timestamp == default)
        {
            reading.Timestamp = DateTime.UtcNow;
        }

        // Score against the existing window *before* adding this reading, so the
        // value is compared to prior history rather than a baseline already
        // pulled toward itself (see FEATURE-02).
        var anomalies = detector.Detect(reading, store.GetWindow());

        store.Add(reading);
        await broadcaster.BroadcastReadingAsync(reading, cancellationToken);

        foreach (var anomaly in anomalies)
        {
            store.AddAnomaly(anomaly);
            await broadcaster.BroadcastAnomalyAsync(anomaly, cancellationToken);
        }

        return reading;
    }
}
