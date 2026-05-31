# R example — Code Scavenge test file

clamp <- function(value, min_val, max_val) {
  max(min_val, min(max_val, value))
}

lerp <- function(a, b, t) {
  a + (b - a) * t
}

normalize <- function(x) {
  (x - min(x)) / (max(x) - min(x))
}

moving_average <- function(x, window = 3) {
  filter(x, rep(1 / window, window), sides = 2)
}

sigmoid <- function(x) {
  1 / (1 + exp(-x))
}

relu <- function(x) {
  pmax(0, x)
}

# S4 class definitions
setClass("Vec2", representation(x = "numeric", y = "numeric"))

setClass("Circle",
  representation(center = "Vec2", radius = "numeric"))

# Generic functions
vec2_add = function(a, b) {
  new("Vec2", x = a@x + b@x, y = a@y + b@y)
}

vec2_dot = function(a, b) {
  a@x * b@x + a@y * b@y
}

vec2_length = function(v) {
  sqrt(v@x^2 + v@y^2)
}
