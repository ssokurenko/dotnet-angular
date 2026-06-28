using Server.Models;
using Server.Services;

namespace Server.Tests;

public class ReadingsStoreTests
{
    [Fact]
    public void Add_keeps_only_the_last_20_readings()
    {
        var store = new ReadingsStore();

        for (var seq = 1; seq <= 25; seq++)
        {
            store.Add(new SensorReading { SequenceNumber = seq });
        }

        var window = store.GetWindow();
        Assert.Equal(ReadingsStore.WindowSize, window.Count); // capped at 20
        Assert.Equal(6, window[0].SequenceNumber);            // oldest kept (25 - 20 + 1)
        Assert.Equal(25, store.GetLatest()!.SequenceNumber);  // newest available
    }
}
