# GDScript example — Code Scavenge test file

enum Direction { NORTH, SOUTH, EAST, WEST }
enum State { IDLE, RUNNING, JUMPING, FALLING, DEAD }

func clamp_value(value: float, lo: float, hi: float) -> float:
	return clamp(value, lo, hi)


func lerp_value(a: float, b: float, t: float) -> float:
	return lerp(a, b, t)


func flatten(arr: Array) -> Array:
	var result = []
	for item in arr:
		if item is Array:
			result.append_array(flatten(item))
		else:
			result.append(item)
	return result


class Vec2:
	var x: float
	var y: float

	func _init(px: float = 0.0, py: float = 0.0) -> void:
		x = px
		y = py

	func add(other: Vec2) -> Vec2:
		return Vec2.new(x + other.x, y + other.y)

	func scale(s: float) -> Vec2:
		return Vec2.new(x * s, y * s)

	func dot(other: Vec2) -> float:
		return x * other.x + y * other.y

	func length() -> float:
		return sqrt(x * x + y * y)


class StateMachine:
	var current_state: String = ""

	func enter(state: String) -> void:
		current_state = state

	func transition(next_state: String) -> void:
		current_state = next_state
