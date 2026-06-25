using Microsoft.AspNetCore.SignalR;

namespace Server.Hubs;

/// <summary>
/// Real-time channel The server pushes <c>ReadingReceived</c> and
/// <c>AnomalyDetected</c> events to all clients via <see cref="IHubContext{T}"/>
/// (see the SignalR broadcaster); clients may call <see cref="Heartbeat"/> to
/// confirm liveness.
/// </summary>
public class SensorHub : Hub
{
    /// <summary>Client-invoked heartbeat. Returns the server time as an ack.</summary>
    public HeartbeatAck Heartbeat() => new(DateTimeOffset.UtcNow);
}

/// <summary>Acknowledgement returned to a client heartbeat.</summary>
public record HeartbeatAck(DateTimeOffset ServerTime);
