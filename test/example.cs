// C# example — Code Scavenge test file

using System;

public static class MathUtils
{
    public static float Clamp(float value, float min, float max)
    {
        return Math.Min(Math.Max(value, min), max);
    }

    public static float Lerp(float a, float b, float t)
    {
        return a + (b - a) * t;
    }

    public static T Max<T>(T a, T b) where T : IComparable<T>
    {
        return a.CompareTo(b) >= 0 ? a : b;
    }
}

public class Vec2
{
    public float X { get; set; }
    public float Y { get; set; }

    public Vec2(float x = 0f, float y = 0f)
    {
        X = x;
        Y = y;
    }

    public Vec2 Add(Vec2 other)
    {
        return new Vec2(X + other.X, Y + other.Y);
    }

    public Vec2 Scale(float factor)
    {
        return new Vec2(X * factor, Y * factor);
    }

    public float Dot(Vec2 other)
    {
        return X * other.X + Y * other.Y;
    }

    public float Length()
    {
        return MathF.Sqrt(X * X + Y * Y);
    }

    public override string ToString()
    {
        return $"Vec2({X}, {Y})";
    }
}

// Struct — value type (stack-allocated, no inheritance)
public struct Point
{
    public float X;
    public float Y;

    public Point(float x, float y) { X = x; Y = y; }
    public float DistanceTo(Point other) => MathF.Sqrt(MathF.Pow(X - other.X, 2) + MathF.Pow(Y - other.Y, 2));
}

public struct Rect
{
    public float X, Y, Width, Height;
    public float Area() => Width * Height;
}

public interface IShape
{
    float Area();
    float Perimeter();
}

public enum Direction { North, South, East, West }

public enum LogLevel { Trace, Debug, Info, Warning, Error, Fatal }
