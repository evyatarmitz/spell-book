// Swift example — Code Scavenge test file

typealias Completion = () -> Void
typealias Handler<T> = (T) -> Void

func clamp<T: Comparable>(_ value: T, min: T, max: T) -> T {
    return Swift.max(min, Swift.min(max, value))
}

func lerp(_ a: Float, _ b: Float, t: Float) -> Float {
    return a + (b - a) * t
}

func greet(name: String) -> String { "Hello, \(name)!" }

protocol Drawable {
    func draw()
    var bounds: CGRect { get }
}

protocol Serializable {
    func encode() -> Data
    static func decode(_ data: Data) -> Self?
}

enum Direction { case north, south, east, west }

enum Result<T> {
    case success(T)
    case failure(Error)
}

struct Vec2 {
    var x: Float
    var y: Float

    func add(_ other: Vec2) -> Vec2 { Vec2(x: x + other.x, y: y + other.y) }
    func scale(_ s: Float)  -> Vec2 { Vec2(x: x * s, y: y * s) }
    func dot(_ other: Vec2) -> Float { x * other.x + y * other.y }
    func length() -> Float { (x * x + y * y).squareRoot() }
}

struct Rect {
    var x, y, width, height: Float
    var area: Float { width * height }
}

class Node {
    var value: Int
    var next: Node?
    init(_ value: Int) { self.value = value }
    func append(_ val: Int) { next = Node(val) }
}

class LinkedList {
    var head: Node?
    func push(_ val: Int) { let n = Node(val); n.next = head; head = n }
    func pop() -> Int? { let v = head?.value; head = head?.next; return v }
}

extension Vec2 {
    static let zero = Vec2(x: 0, y: 0)
    func normalized() -> Vec2 {
        let len = length()
        return len > 0 ? scale(1 / len) : .zero
    }
}
