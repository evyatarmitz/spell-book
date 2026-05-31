# Julia example — Code Scavenge test file

module MathUtils

export clamp, lerp, normalize

function clamp(value::T, lo::T, hi::T) where T<:Real
    value < lo ? lo : value > hi ? hi : value
end

function lerp(a::T, b::T, t::Real)::T where T<:Number
    a + (b - a) * t
end

normalize(v::AbstractVector) = v / norm(v)

# Short-form functions
sigmoid(x) = 1 / (1 + exp(-x))
relu(x)    = max(zero(x), x)

end  # module MathUtils

# Structs
struct Vec2
    x::Float32
    y::Float32
end

mutable struct Particle
    position::Vec2
    velocity::Vec2
    mass::Float32
end

# Abstract types
abstract type Shape end
abstract type Geometry2D <: Shape end

# Primitive type (example)
primitive type Flags8 8 end

# Struct methods via multiple dispatch
function add(a::Vec2, b::Vec2)
    Vec2(a.x + b.x, a.y + b.y)
end

function scale(v::Vec2, s::Real)
    Vec2(v.x * s, v.y * s)
end

dot(a::Vec2, b::Vec2) = a.x * b.x + a.y * b.y
Base.length(v::Vec2)  = sqrt(v.x^2 + v.y^2)

# Macro
macro timed(expr)
    quote
        t0 = time()
        val = $(esc(expr))
        println("Elapsed: ", time() - t0, "s")
        val
    end
end
