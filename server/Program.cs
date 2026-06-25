using Server.Hubs;
using Server.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddSignalR();

// In-memory store for readings + anomalies
builder.Services.AddSingleton<ReadingsStore>();

// Z-score anomaly detection
builder.Services.AddSingleton<AnomalyDetector>();

// Real-time broadcaster backed by the SignalR hub.
builder.Services.AddSingleton<IReadingBroadcaster, SignalRReadingBroadcaster>();

// Shared store -> detect -> broadcast pipeline for POST and the simulator.
builder.Services.AddSingleton<ReadingIngestor>();

// 1. Define the CORS policy
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularClient", policy =>
    {
        policy.WithOrigins("http://localhost:4200") // Angular default dev port
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // required for SignalR websockets
    });
});

var app = builder.Build();

app.UseHttpsRedirection();

// 2. Enable CORS before Authorization
app.UseCors("AllowAngularClient");

app.UseAuthorization();

// Readings + anomalies are served by attribute-routed controllers (see Controllers/).
app.MapControllers();

// Real-time hub.
app.MapHub<SensorHub>("/hubs/sensors");

// Demo endpoint to confirm the server is running.
app.MapGet("/api/heartbeat", () => Results.Ok(new
{
    status = "OK",
    message = "Server is running",
    timestamp = DateTimeOffset.UtcNow
}));

app.Run();