/* C example — Code Scavenge test file */

#include <math.h>

/* Preprocessor macros */
#define CLAMP(x, lo, hi)  ((x) < (lo) ? (lo) : (x) > (hi) ? (hi) : (x))
#define LERP(a, b, t)     ((a) + ((b) - (a)) * (t))
#define ARRAY_LEN(a)      (sizeof(a) / sizeof((a)[0]))
#define MIN(a, b)         ((a) < (b) ? (a) : (b))
#define MAX(a, b)         ((a) > (b) ? (a) : (b))

float clamp(float value, float min, float max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

float lerp(float a, float b, float t) {
    return a + (b - a) * t;
}

int count_bits(unsigned int n) {
    int count = 0;
    while (n) {
        count += n & 1;
        n >>= 1;
    }
    return count;
}

/* Enum */
enum Color { COLOR_RED, COLOR_GREEN, COLOR_BLUE, COLOR_ALPHA };
enum Direction { DIR_NORTH, DIR_SOUTH, DIR_EAST, DIR_WEST };

/* Named struct — detected by scanner */
struct Vec2 {
    float x;
    float y;
};
typedef struct Vec2 Vec2;

Vec2 vec2_add(Vec2 a, Vec2 b) {
    Vec2 result = { a.x + b.x, a.y + b.y };
    return result;
}

Vec2 vec2_scale(Vec2 v, float s) {
    Vec2 result = { v.x * s, v.y * s };
    return result;
}

float vec2_dot(Vec2 a, Vec2 b) {
    return a.x * b.x + a.y * b.y;
}

float vec2_length(Vec2 v) {
    return sqrtf(v.x * v.x + v.y * v.y);
}
