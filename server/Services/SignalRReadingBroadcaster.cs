using Microsoft.AspNetCore.SignalR;
using Server.Hubs;
using Server.Models;

namespace Server.Services;

/// <summary>
/// Broadcasts readings and anomalies to all connected clients over the
/// <see cref="SensorHub"/>. Event names must match the client
/// handlers: <c>ReadingReceived</c> and <c>AnomalyDetected</c>.
/// </summary>
public sealed class SignalRReadingBroadcaster(IHubContext<SensorHub> hub) : IReadingBroadcaster
{
    public Task BroadcastReadingAsync(SensorReading reading, CancellationToken cancellationToken = default) =>
        hub.Clients.All.SendAsync("ReadingReceived", reading, cancellationToken);

    public Task BroadcastAnomalyAsync(Anomaly anomaly, CancellationToken cancellationToken = default) =>
        hub.Clients.All.SendAsync("AnomalyDetected", anomaly, cancellationToken);
}
