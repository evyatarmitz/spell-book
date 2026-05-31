# Elixir example — Code Scavenge test file

defmodule MathUtils do
  def clamp(value, min, max) do
    value |> max(min) |> min(max)
  end

  def lerp(a, b, t), do: a + (b - a) * t

  def factorial(0), do: 1
  def factorial(n) when n > 0, do: n * factorial(n - 1)

  defp private_helper(x), do: x * 2
end

defmodule Vec2 do
  defstruct x: 0.0, y: 0.0

  def new(x, y), do: %Vec2{x: x, y: y}
  def zero,       do: %Vec2{x: 0.0, y: 0.0}

  def add(%Vec2{x: x1, y: y1}, %Vec2{x: x2, y: y2}),
    do: %Vec2{x: x1 + x2, y: y1 + y2}

  def scale(%Vec2{x: x, y: y}, s),
    do: %Vec2{x: x * s, y: y * s}

  def dot(%Vec2{x: x1, y: y1}, %Vec2{x: x2, y: y2}),
    do: x1 * x2 + y1 * y2

  def length(%Vec2{x: x, y: y}),
    do: :math.sqrt(x * x + y * y)
end

defprotocol Serializable do
  def serialize(data)
  def deserialize(type, raw)
end

defmacro defguard_positive(name) do
  quote do
    defguard unquote(name)(x) when is_number(x) and x > 0
  end
end

defmacro timed(do: block) do
  quote do
    t0 = System.monotonic_time(:millisecond)
    result = unquote(block)
    IO.puts("Elapsed: #{System.monotonic_time(:millisecond) - t0} ms")
    result
  end
end
