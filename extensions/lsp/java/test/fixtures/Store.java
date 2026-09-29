package fixtures;

import java.util.ArrayList;
import java.util.List;

public class Store {
    private final List<String> items = new ArrayList<>();

    public void add(String item) {
        items.add(item);
    }
}
