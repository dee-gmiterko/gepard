class_name Store
extends RefCounted

signal changed

const VERSION := 1

var items: Array[String] = []


func add(item: String) -> void:
	items.append(item)
	changed.emit()


func count() -> int:
	return items.size()
