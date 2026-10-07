#include "store.h"

int main() {
  shop::Store store;
  store.add(1);
  return store.count();
}
