// Groovy example — Code Scavenge test file

def clamp(double value, double min, double max) {
    Math.max(min, Math.min(max, value))
}

double lerp(double a, double b, double t) {
    a + (b - a) * t
}

static String slugify(String s) {
    s.toLowerCase().replaceAll(/[^a-z0-9]+/, '-')
}

interface Drawable {
    void draw()
    Map getBounds()
}

enum Direction { NORTH, SOUTH, EAST, WEST }

enum Status {
    OK(200), NOT_FOUND(404), ERROR(500)
    Status(int code) { this.code = code }
    final int code
}

class Vec2 {
    double x, y

    Vec2(double x = 0.0, double y = 0.0) { this.x = x; this.y = y }

    Vec2 add(Vec2 other) { new Vec2(x + other.x, y + other.y) }
    Vec2 scale(double s)  { new Vec2(x * s, y * s) }
    double dot(Vec2 other) { x * other.x + y * other.y }
    double length()        { Math.sqrt(x * x + y * y) }

    @Override
    String toString() { "Vec2($x, $y)" }
}

class EventBus {
    private Map<String, List<Closure>> listeners = [:]

    void on(String event, Closure handler) {
        listeners.computeIfAbsent(event) { [] } << handler
    }

    void emit(String event, Object data = null) {
        listeners[event]?.each { it(data) }
    }

    void off(String event) {
        listeners.remove(event)
    }
}
