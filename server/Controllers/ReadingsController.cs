using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/readings")]
public class ReadingsController(ReadingsStore store, ReadingIngestor ingestor) : ControllerBase
{
    // Web defaults => camelCase, case-insensitive — matches the Angular client JSON.
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [HttpGet("latest")]
    [ProducesResponseType(typeof(SensorReading), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public IActionResult GetLatest()
    {
        var latest = store.GetLatest();
        return latest is null ? NoContent() : Ok(latest);
    }

    [HttpPost]
    [Consumes("application/json")]
    [ProducesResponseType(typeof(IEnumerable<SensorReading>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] JsonElement body, CancellationToken cancellationToken)
    {
        List<SensorReading> incoming;
        try
        {
            switch (body.ValueKind)
            {
                case JsonValueKind.Array:
                    incoming = body.Deserialize<List<SensorReading>>(JsonOptions) ?? [];
                    break;
                case JsonValueKind.Object:
                    var single = body.Deserialize<SensorReading>(JsonOptions);
                    incoming = single is null ? [] : [single];
                    break;
                default:
                    return BadRequest("Expected a reading object or an array of readings.");
            }
        }
        catch (JsonException)
        {
            return BadRequest("Invalid reading payload.");
        }

        if (incoming.Count == 0)
        {
            return BadRequest("No readings provided.");
        }

        var created = new List<SensorReading>(incoming.Count);
        foreach (var reading in incoming)
        {
            created.Add(await ingestor.IngestAsync(reading, cancellationToken));
        }

        return Created("/api/readings/latest", created);
    }
}
