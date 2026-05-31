# Nim example — Code Scavenge test file

type
  Direction* = enum
    North, South, East, West

  Vec2* = object
    x*, y*: float32

  Circle* = object
    center*: Vec2
    radius*: float32

  Stack*[T] = object
    items: seq[T]

proc clamp*(value, min, max: float32): float32 =
  if value < min: min
  elif value > max: max
  else: value

proc lerp*(a, b, t: float32): float32 =
  a + (b - a) * t

func dot*(a, b: Vec2): float32 =
  a.x * b.x + a.y * b.y

func length*(v: Vec2): float32 =
  sqrt(v.x * v.x + v.y * v.y)

proc add*(a, b: Vec2): Vec2 =
  Vec2(x: a.x + b.x, y: a.y + b.y)

proc scale*(v: Vec2, s: float32): Vec2 =
  Vec2(x: v.x * s, y: v.y * s)

proc normalized*(v: Vec2): Vec2 =
  let len = v.length
  if len > 0: v.scale(1.0 / len) else: Vec2()

method area*(shape: Circle): float32 {.base.} =
  3.14159 * shape.radius * shape.radius

method perimeter*(shape: Circle): float32 {.base.} =
  2.0 * 3.14159 * shape.radius

template withTimer*(label: string, body: untyped): untyped =
  let t0 = epochTime()
  body
  echo label, ": ", epochTime() - t0, "s"

macro debugEcho*(x: untyped): untyped =
  quote do:
    echo astToStr(`x`), " = ", `x`
