# Ruby example — Code Scavenge test file

def clamp(value, min, max)
  [[value, min].max, max].min
end

def lerp(a, b, t)
  a + (b - a) * t
end

def slugify(str)
  str.downcase.gsub(/[^a-z0-9]+/, '-')
end

module Serializable
  def serialize
    instance_variables.map { |v| [v, instance_variable_get(v)] }.to_h
  end

  def to_json
    serialize.to_s
  end
end

module Logging
  def log(msg)
    puts "[#{self.class}] #{msg}"
  end
end

class Vec2
  include Logging

  attr_accessor :x, :y

  def initialize(x = 0.0, y = 0.0)
    @x = x
    @y = y
  end

  def add(other)
    Vec2.new(@x + other.x, @y + other.y)
  end

  def scale(s)
    Vec2.new(@x * s, @y * s)
  end

  def dot(other)
    @x * other.x + @y * other.y
  end

  def length
    Math.sqrt(@x**2 + @y**2)
  end

  def to_s
    "(#{@x}, #{@y})"
  end
end

class Shape
  def area
    raise NotImplementedError
  end

  def perimeter
    raise NotImplementedError
  end
end

class Circle < Shape
  attr_reader :radius

  def initialize(radius)
    @radius = radius
  end

  def area
    Math::PI * @radius**2
  end

  def perimeter
    2 * Math::PI * @radius
  end
end
