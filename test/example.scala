// Scala example — Code Scavenge test file

type Predicate[A] = A => Boolean
type Matrix       = Array[Array[Double]]

def clamp(value: Double, min: Double, max: Double): Double =
  math.max(min, math.min(max, value))

def lerp(a: Double, b: Double, t: Double): Double = a + (b - a) * t

def identity[A](x: A): A = x

trait Drawable {
  def draw(): Unit
  def bounds: (Double, Double, Double, Double)
}

trait Serializable[A] {
  def encode(a: A): String
  def decode(s: String): Option[A]
}

sealed trait Direction
case object North extends Direction
case object South extends Direction
case object East  extends Direction
case object West  extends Direction

enum Color:
  case Red, Green, Blue

case class Vec2(x: Double, y: Double) {
  def add(other: Vec2)  = Vec2(x + other.x, y + other.y)
  def scale(s: Double)  = Vec2(x * s, y * s)
  def dot(other: Vec2)  = x * other.x + y * other.y
  def length: Double    = math.sqrt(x * x + y * y)
  def normalized: Vec2  = if (length > 0) scale(1.0 / length) else Vec2(0, 0)
}

class Stack[A] {
  private var items: List[A] = Nil
  def push(item: A): Unit = items = item :: items
  def pop(): Option[A]    = items match { case h :: t => items = t; Some(h); case _ => None }
  def peek: Option[A]     = items.headOption
  def isEmpty: Boolean    = items.isEmpty
}

object MathUtils {
  def factorial(n: Int): Long = if (n <= 1) 1L else n * factorial(n - 1)
  def fibonacci(n: Int): Long = if (n <= 1) n else fibonacci(n - 1) + fibonacci(n - 2)
}
