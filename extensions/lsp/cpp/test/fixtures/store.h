#pragma once

#include <vector>

namespace shop {

class Store {
public:
  void add(int item);
  int count() const;

private:
  std::vector<int> items_;
};

}  // namespace shop
