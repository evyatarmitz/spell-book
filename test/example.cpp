// C++ example — Code Scavenge test file

#include <cmath>
#include <vector>
#include <string>

// Preprocessor macros
#define CLAMP(x, lo, hi) ((x) < (lo) ? (lo) : (x) > (hi) ? (hi) : (x))
#define LERP(a, b, t)    ((a) + ((b) - (a)) * (t))
#define PI               3.14159265358979323846
#define ARRAY_SIZE(arr)  (sizeof(arr) / sizeof((arr)[0]))

float clamp(float value, float min, float max) {
    return std::min(std::max(value, min), max);
}

template<typename T>
T lerp(T a, T b, float t) {
    return a + static_cast<T>((b - a) * t);
}

static inline bool is_power_of_two(unsigned int n) {
    return n && !(n & (n - 1));
}

class Vec2 {
public:
    float x, y;

    Vec2(float x = 0.f, float y = 0.f) : x(x), y(y) {}

    Vec2 operator+(const Vec2& other) const {
        return Vec2(x + other.x, y + other.y);
    }

    Vec2 operator*(float s) const {
        return Vec2(x * s, y * s);
    }

    float dot(const Vec2& other) const {
        return x * other.x + y * other.y;
    }

    float length() const {
        return std::sqrt(x * x + y * y);
    }

    Vec2 normalized() const {
        float len = length();
        return len > 0.f ? Vec2(x / len, y / len) : Vec2();
    }
};

// C++ struct (plain data, no access control)
struct Rect {
    float x, y, width, height;
};

struct Color {
    uint8_t r, g, b, a;
};

// C++ enum class (scoped enum)
enum class Direction { North, South, East, West };
enum class BlendMode : uint8_t { None, Add, Multiply, Screen };

class EventEmitter {
public:
    void emit(const std::string& event) {}
    void listen(const std::string& event) {}
    void clear() {}
};

// Out-of-class method definition (qualified name)
void EventEmitter::clear() {
    // reset all listeners
}
