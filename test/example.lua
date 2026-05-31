-- Lua example — Code Scavenge test file

function clamp(value, lo, hi)
  if value < lo then return lo end
  if value > hi then return hi end
  return value
end

function lerp(a, b, t)
  return a + (b - a) * t
end

local function factorial(n)
  if n <= 1 then return 1 end
  return n * factorial(n - 1)
end

-- Class-style OOP with metatables
Vec2 = {}
Vec2.__index = Vec2

function Vec2.new(x, y)
  return setmetatable({ x = x or 0, y = y or 0 }, Vec2)
end

function Vec2:add(other)
  return Vec2.new(self.x + other.x, self.y + other.y)
end

function Vec2:scale(s)
  return Vec2.new(self.x * s, self.y * s)
end

function Vec2:dot(other)
  return self.x * other.x + self.y * other.y
end

function Vec2:length()
  return math.sqrt(self.x * self.x + self.y * self.y)
end

function Vec2:__tostring()
  return string.format("Vec2(%.2f, %.2f)", self.x, self.y)
end
