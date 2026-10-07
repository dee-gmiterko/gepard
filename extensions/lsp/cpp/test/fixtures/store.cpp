#include "store.h"

namespace shop {

void Store::add(int item) { items_.push_back(item); }

int Store::count() const { return static_cast<int>(items_.size()); }

}  // namespace shop
