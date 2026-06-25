using Microsoft.AspNetCore.Mvc;
using Server.Services;

namespace Server.Controllers;

[ApiController]
[Route("api/anomalies")]
public class AnomaliesController(ReadingsStore store) : ControllerBase
{
    [HttpGet]
    public IActionResult Get() =>
        Ok(store.GetRecentAnomalies(ReadingsStore.MaxAnomalies));
}
