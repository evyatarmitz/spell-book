// Zig example — Code Scavenge test file

const std = @import("std");

pub fn clamp(value: f32, min: f32, max: f32) f32 {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

pub fn lerp(a: f32, b: f32, t: f32) f32 {
    return a + (b - a) * t;
}

pub fn isPowerOfTwo(n: u32) bool {
    return n != 0 and (n & (n - 1)) == 0;
}

fn factorial(n: u64) u64 {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

pub const Vec2 = struct {
    x: f32 = 0,
    y: f32 = 0,

    pub fn add(self: Vec2, other: Vec2) Vec2 {
        return .{ .x = self.x + other.x, .y = self.y + other.y };
    }

    pub fn scale(self: Vec2, s: f32) Vec2 {
        return .{ .x = self.x * s, .y = self.y * s };
    }

    pub fn dot(self: Vec2, other: Vec2) f32 {
        return self.x * other.x + self.y * other.y;
    }

    pub fn length(self: Vec2) f32 {
        return std.math.sqrt(self.x * self.x + self.y * self.y);
    }
};

pub const Color = enum {
    Red,
    Green,
    Blue,
    Alpha,
};

pub const Direction = enum { North, South, East, West };

pub const Error = error{
    OutOfMemory,
    InvalidInput,
    Overflow,
};
