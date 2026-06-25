namespace Server.Models;

/// <summary>
/// A flagged out-of-range value detected by z-score analysis over the
/// rolling window of readings.
/// </summary>
public class Anomaly
{
    public Guid Id { get; set; }
    public DateTime DetectedAt { get; set; }
    public string SensorType { get; set; } = string.Empty;
    public decimal Value { get; set; }
    public decimal ZScore { get; set; }
    public string Reason { get; set; } = string.Empty;
}
