# Crystal example — Code Scavenge test file

def clamp(value : Float64, min : Float64, max : Float64) : Float64
  value < min ? min : value > max ? max : value
end

def lerp(a : Float64, b : Float64, t : Float64) : Float64
  a + (b - a) * t
end

def slugify(s : String) : String
  s.downcase.gsub(/[^a-z0-9]+/, "-")
end

module Serializable
  abstract def to_json : String
  abstract def to_h : Hash(String, JSON::Any)
end

module Logging
  def log(msg : String)
    STDOUT.puts "[#{self.class}] #{msg}"
  end
end

enum Direction
  North
  South
  East
  West
end

enum Status : UInt16
  Ok       = 200
  NotFound = 404
  Error    = 500
end

struct Vec2
  getter x : Float64, y : Float64

  def initialize(@x : Float64 = 0.0, @y : Float64 = 0.0)
  end

  def add(other : Vec2) : Vec2 = Vec2.new(x + other.x, y + other.y)
  def scale(s : Float64) : Vec2 = Vec2.new(x * s, y * s)
  def dot(other : Vec2) : Float64 = x * other.x + y * other.y
  def length : Float64 = Math.sqrt(x ** 2 + y ** 2)
end

class Stack(T)
  include Logging

  def initialize
    @items = [] of T
  end

  def push(item : T) : Nil
    @items << item
  end

  def pop : T?
    @items.pop?
  end

  def peek : T?
    @items.last?
  end

  def empty? : Bool
    @items.empty?
  end
end

macro assert_not_nil(val)
  raise "Expected non-nil" if {{val}}.nil?
end

macro timed(label, &block)
  t0 = Time.monotonic
  {{block.body}}
  puts "#{{{label}}}: #{(Time.monotonic - t0).total_milliseconds}ms"
end
