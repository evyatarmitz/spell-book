// D example — Code Scavenge test file
module mathutils;

import std.math;
import std.algorithm;

// ── Enums ─────────────────────────────────────────────────────

enum Direction { North, South, East, West }

enum Color : ubyte { Red = 0, Green = 1, Blue = 2 }

// ── Structs ───────────────────────────────────────────────────

struct Vec2 {
    float x, y;

    Vec2 opAdd(Vec2 other) {
        return Vec2(x + other.x, y + other.y);
    }

    Vec2 opMul(float s) {
        return Vec2(x * s, y * s);
    }

    float dot(Vec2 other) {
        return x * other.x + y * other.y;
    }

    float length() {
        return sqrt(x * x + y * y);
    }

    Vec2 normalize() {
        float len = length();
        return len > 0 ? Vec2(x / len, y / len) : Vec2(0, 0);
    }
}

struct Rect {
    float x, y, width, height;

    bool contains(Vec2 p) {
        return p.x >= x && p.x <= x + width &&
               p.y >= y && p.y <= y + height;
    }
}

// ── Interfaces ────────────────────────────────────────────────

interface Shape {
    float area();
    float perimeter();
    string name();
}

interface Serializable {
    string serialize();
    void deserialize(string data);
}

// ── Classes ───────────────────────────────────────────────────

class Circle : Shape {
    float radius;

    this(float r) { radius = r; }

    float area() {
        return PI * radius * radius;
    }

    float perimeter() {
        return 2.0f * PI * radius;
    }

    string name() { return "Circle"; }
}

class Rectangle : Shape {
    float width, height;

    this(float w, float h) { width = w; height = h; }

    float area() {
        return width * height;
    }

    float perimeter() {
        return 2.0f * (width + height);
    }

    string name() { return "Rectangle"; }
}

class Stack(T) {
    private T[] items;

    void push(T item) {
        items ~= item;
    }

    T pop() {
        T item = items[$ - 1];
        items = items[0 .. $ - 1];
        return item;
    }

    T peek() {
        return items[$ - 1];
    }

    bool empty() {
        return items.length == 0;
    }

    size_t length() {
        return items.length;
    }
}

// ── Free functions ────────────────────────────────────────────

float clamp(float value, float lo, float hi) {
    return max(lo, min(hi, value));
}

float lerp(float a, float b, float t) {
    return a + (b - a) * t;
}

float sigmoid(float x) {
    return 1.0f / (1.0f + exp(-x));
}

long factorial(long n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

T[] filter(T)(T[] arr, bool delegate(T) pred) {
    T[] result;
    foreach (item; arr)
        if (pred(item)) result ~= item;
    return result;
}

T[] mapArray(T, U)(U[] arr, T delegate(U) fn) {
    T[] result;
    foreach (item; arr)
        result ~= fn(item);
    return result;
}
