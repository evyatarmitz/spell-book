// Go example — Code Scavenge test file

package main

import "math"

func Clamp(value, min, max float64) float64 {
	if value < min {
		return min
	}
	if value > max {
		return max
	}
	return value
}

func Lerp(a, b, t float64) float64 {
	return a + (b-a)*t
}

func Contains[T comparable](slice []T, item T) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}

// Type alias
type Float64 = float64

// Interface
type Shape interface {
	Area() float64
	Perimeter() float64
}

type Stringer interface {
	String() string
}

type Vec2 struct {
	X, Y float64
}

func NewVec2(x, y float64) Vec2 {
	return Vec2{X: x, Y: y}
}

func (v Vec2) Add(other Vec2) Vec2 {
	return Vec2{X: v.X + other.X, Y: v.Y + other.Y}
}

func (v Vec2) Scale(s float64) Vec2 {
	return Vec2{X: v.X * s, Y: v.Y * s}
}

func (v Vec2) Dot(other Vec2) float64 {
	return v.X*other.X + v.Y*other.Y
}

func (v Vec2) Length() float64 {
	return math.Sqrt(v.X*v.X + v.Y*v.Y)
}
