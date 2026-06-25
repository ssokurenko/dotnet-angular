using Microsoft.AspNetCore.Mvc;
using Server.Models;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/anomalies")]
public class AnomaliesController(ReadingsStore store) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<Anomaly>), StatusCodes.Status200OK)]
    public IActionResult Get() =>
        Ok(store.GetRecentAnomalies(ReadingsStore.MaxAnomalies));
}
