// Odin example — Code Scavenge test file

package main

import "core:math"
import "core:fmt"

// ── Types ─────────────────────────────────────────────────────

Vec2 :: struct {
    x, y: f32,
}

Vec3 :: struct {
    x, y, z: f32,
}

Rect :: struct {
    x, y, width, height: f32,
}

Direction :: enum {
    North,
    South,
    East,
    West,
}

Color :: enum u8 {
    Red,
    Green,
    Blue,
    Alpha,
}

// ── Functions ─────────────────────────────────────────────────

clamp :: proc(value, lo, hi: f32) -> f32 {
    if value < lo do return lo
    if value > hi do return hi
    return value
}

lerp :: proc(a, b, t: f32) -> f32 {
    return a + (b - a) * t
}

vec2_add :: proc(a, b: Vec2) -> Vec2 {
    return Vec2{a.x + b.x, a.y + b.y}
}

vec2_scale :: proc(v: Vec2, s: f32) -> Vec2 {
    return Vec2{v.x * s, v.y * s}
}

vec2_dot :: proc(a, b: Vec2) -> f32 {
    return a.x * b.x + a.y * b.y
}

vec2_length :: proc(v: Vec2) -> f32 {
    return math.sqrt(v.x * v.x + v.y * v.y)
}

rect_area :: proc(r: Rect) -> f32 {
    return r.width * r.height
}

rect_contains :: proc(r: Rect, p: Vec2) -> bool {
    return p.x >= r.x && p.x <= r.x + r.width &&
           p.y >= r.y && p.y <= r.y + r.height
}
