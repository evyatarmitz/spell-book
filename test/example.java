// Java example — Code Scavenge test file

public class MathUtils {

    public static float clamp(float value, float min, float max) {
        return Math.min(Math.max(value, min), max);
    }

    public static float lerp(float a, float b, float t) {
        return a + (b - a) * t;
    }

    public static <T extends Comparable<T>> T max(T a, T b) {
        return a.compareTo(b) >= 0 ? a : b;
    }
}

class Vec2 {
    public float x;
    public float y;

    public Vec2(float x, float y) {
        this.x = x;
        this.y = y;
    }

    public Vec2 add(Vec2 other) {
        return new Vec2(this.x + other.x, this.y + other.y);
    }

    public Vec2 scale(float factor) {
        return new Vec2(this.x * factor, this.y * factor);
    }

    public float dot(Vec2 other) {
        return this.x * other.x + this.y * other.y;
    }

    public float length() {
        return (float) Math.sqrt(this.x * this.x + this.y * this.y);
    }

    @Override
    public String toString() {
        return "Vec2(" + x + ", " + y + ")";
    }
}

// Annotation type (@interface)
@interface Nullable {}
@interface NonNull {}

interface Shape {
    float area();
    float perimeter();
}

enum Direction {
    NORTH, SOUTH, EAST, WEST;

    public Direction opposite() {
        return switch (this) {
            case NORTH -> SOUTH;
            case SOUTH -> NORTH;
            case EAST  -> WEST;
            case WEST  -> EAST;
        };
    }
}
