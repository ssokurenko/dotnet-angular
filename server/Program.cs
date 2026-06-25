var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

// 1. Define the CORS policy
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularClient", policy =>
    {
        policy.WithOrigins("http://localhost:4200") // Angular default dev port
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseHttpsRedirection();

// 2. Enable CORS before Authorization
app.UseCors("AllowAngularClient");

app.UseAuthorization();
app.MapControllers();

// Demo endpoint to confirm the server is running.
app.MapGet("/api/heartbeat", () => Results.Ok(new
{
    status = "OK",
    message = "Server is running",
    timestamp = DateTimeOffset.UtcNow
}));

app.Run();