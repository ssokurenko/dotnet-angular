using System.Reflection;
using Microsoft.OpenApi;
using Server.Hubs;
using Server.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddSignalR();

// OpenAPI / Swagger documentation for the REST endpoints.
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Greenhouse Guard API",
        Version = "v1",
        Description = "Real-time greenhouse sensor readings and z-score anomaly detection."
    });

    // Surface the /// summaries from controllers and models.
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }
});

// In-memory store for readings + anomalies
builder.Services.AddSingleton<ReadingsStore>();

// Z-score anomaly detection
builder.Services.AddSingleton<AnomalyDetector>();

// Real-time broadcaster backed by the SignalR hub.
builder.Services.AddSingleton<IReadingBroadcaster, SignalRReadingBroadcaster>();

// Shared store -> detect -> broadcast pipeline for POST and the simulator.
builder.Services.AddSingleton<ReadingIngestor>();

// Generates mock greenhouse readings every ~2s (real-time streaming).
builder.Services.AddHostedService<SensorSimulator>();

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

// Swagger UI at /swagger (JSON at /swagger/v1/swagger.json) in development.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Greenhouse Guard API v1");
    });
}

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