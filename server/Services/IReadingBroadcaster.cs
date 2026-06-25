using Server.Models;

namespace Server.Services;

/// <summary>
/// Pushes new readings and anomalies to connected clients.
/// </summary>
public interface IReadingBroadcaster
{
    Task BroadcastReadingAsync(SensorReading reading, CancellationToken cancellationToken = default);

    Task BroadcastAnomalyAsync(Anomaly anomaly, CancellationToken cancellationToken = default);
}

/// <summary>No-op broadcaster used until the SignalR hub is wired in (FEATURE-04).</summary>
public sealed class NullReadingBroadcaster : IReadingBroadcaster
{
    public Task BroadcastReadingAsync(SensorReading reading, CancellationToken cancellationToken = default)
        => Task.CompletedTask;

    public Task BroadcastAnomalyAsync(Anomaly anomaly, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}
