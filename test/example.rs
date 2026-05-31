// Rust example — Code Scavenge test file

pub fn clamp(value: f32, min: f32, max: f32) -> f32 {
    value.max(min).min(max)
}

pub fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

pub fn flatten<T: Clone>(nested: Vec<Vec<T>>) -> Vec<T> {
    nested.into_iter().flatten().collect()
}

async fn fetch_bytes(url: &str) -> Result<Vec<u8>, String> {
    Ok(vec![])
}

pub enum Direction { North, South, East, West }

pub enum Color {
    Rgb(u8, u8, u8),
    Rgba(u8, u8, u8, u8),
    Hex(u32),
}

pub struct Vec2 {
    pub x: f32,
    pub y: f32,
}

impl Vec2 {
    pub fn new(x: f32, y: f32) -> Self {
        Vec2 { x, y }
    }

    pub fn add(&self, other: &Vec2) -> Vec2 {
        Vec2::new(self.x + other.x, self.y + other.y)
    }

    pub fn dot(&self, other: &Vec2) -> f32 {
        self.x * other.x + self.y * other.y
    }

    pub fn length(&self) -> f32 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}

// Macro
macro_rules! vec2 {
    ($x:expr, $y:expr) => { Vec2::new($x, $y) };
    (0) => { Vec2::new(0.0, 0.0) };
}

// Type alias
pub type Result<T> = std::result::Result<T, String>;
pub type Callback = fn(f32, f32) -> f32;

pub trait Shape {
    fn area(&self) -> f32;
    fn perimeter(&self) -> f32;
}

pub struct Circle {
    pub radius: f32,
}

impl Shape for Circle {
    fn area(&self) -> f32 {
        std::f32::consts::PI * self.radius * self.radius
    }

    fn perimeter(&self) -> f32 {
        2.0 * std::f32::consts::PI * self.radius
    }
}
