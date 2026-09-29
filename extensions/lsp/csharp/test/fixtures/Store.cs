namespace Gepard.Fixtures;

public class Store
{
    public List<string> Items { get; } = new();

    public void Add(string item)
    {
        Items.Add(item);
    }
}
