<?php

namespace Shop;

class Store
{
    private array $items = [];

    public function add(string $name): void
    {
        $this->items[] = $name;
    }

    public function count(): int
    {
        return count($this->items);
    }
}
