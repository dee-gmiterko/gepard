class_name Repository
extends RefCounted

var store: Store = Store.new()


func make_store() -> Store:
	var fresh := Store.new()
	fresh.add("seed")
	return fresh
