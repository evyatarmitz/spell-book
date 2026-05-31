<?php
// PHP example — Code Scavenge test file

function clamp(float $value, float $min, float $max): float {
    return max($min, min($max, $value));
}

function lerp(float $a, float $b, float $t): float {
    return $a + ($b - $a) * $t;
}

function slugify(string $str): string {
    return strtolower(preg_replace('/[^a-z0-9]+/i', '-', $str));
}

interface Drawable {
    public function draw(): void;
    public function getBounds(): array;
}

interface Serializable {
    public function serialize(): string;
    public static function deserialize(string $data): static;
}

trait Logging {
    public function log(string $message): void {
        echo "[" . get_class($this) . "] $message\n";
    }
}

enum Direction {
    case North;
    case South;
    case East;
    case West;
}

enum Status: int {
    case Ok      = 200;
    case NotFound = 404;
    case Error   = 500;
}

class Vec2 {
    use Logging;

    public function __construct(
        public float $x = 0.0,
        public float $y = 0.0,
    ) {}

    public function add(Vec2 $other): Vec2 {
        return new Vec2($this->x + $other->x, $this->y + $other->y);
    }

    public function scale(float $s): Vec2 {
        return new Vec2($this->x * $s, $this->y * $s);
    }

    public function dot(Vec2 $other): float {
        return $this->x * $other->x + $this->y * $other->y;
    }

    public function length(): float {
        return sqrt($this->x ** 2 + $this->y ** 2);
    }
}

abstract class Shape {
    abstract public function area(): float;
    abstract public function perimeter(): float;
}

class Circle extends Shape implements Drawable {
    public function __construct(public readonly float $radius) {}

    public function area(): float      { return M_PI * $this->radius ** 2; }
    public function perimeter(): float { return 2 * M_PI * $this->radius; }
    public function draw(): void       { echo "Circle(r={$this->radius})"; }
    public function getBounds(): array { $d = $this->radius * 2; return ['w' => $d, 'h' => $d]; }
}
