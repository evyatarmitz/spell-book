// Dart example — Code Scavenge test file

double clamp(double value, double min, double max) =>
    value < min ? min : value > max ? max : value;

double lerp(double a, double b, double t) => a + (b - a) * t;

String slugify(String s) =>
    s.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '-');

mixin Serializable {
  Map<String, dynamic> toJson();
  String toJsonString() => toJson().toString();
}

enum Direction { north, south, east, west }

enum Status { ok, notFound, error }

class Vec2 {
  final double x, y;
  const Vec2(this.x, this.y);

  Vec2 add(Vec2 other) => Vec2(x + other.x, y + other.y);
  Vec2 scale(double s)  => Vec2(x * s, y * s);
  double dot(Vec2 other) => x * other.x + y * other.y;
  double get length      => (x * x + y * y).sqrt();

  @override
  String toString() => 'Vec2($x, $y)';
}

abstract class Shape {
  double get area;
  double get perimeter;
}

class Circle extends Shape with Serializable {
  final double radius;
  Circle(this.radius);

  @override double get area      => 3.14159 * radius * radius;
  @override double get perimeter => 2 * 3.14159 * radius;
  @override Map<String, dynamic> toJson() => {'radius': radius};
}

extension Vec2Extension on Vec2 {
  Vec2 normalized() {
    final len = length;
    return len > 0 ? scale(1 / len) : const Vec2(0, 0);
  }
}
