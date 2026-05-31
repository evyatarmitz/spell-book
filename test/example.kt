// Kotlin example — Code Scavenge test file

typealias Predicate<T> = (T) -> Boolean
typealias Matrix = Array<FloatArray>

fun clamp(value: Float, min: Float, max: Float): Float = maxOf(min, minOf(max, value))

fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t

suspend fun fetchData(url: String): String = ""

fun <T> identity(value: T): T = value

fun String.slugify(): String = this.lowercase().replace(Regex("[^a-z0-9]+"), "-")

interface Drawable {
    fun draw()
    fun getBounds(): Rect
}

interface Serializable {
    fun serialize(): String
    fun deserialize(data: String)
}

enum class Direction { NORTH, SOUTH, EAST, WEST }

enum class Status(val code: Int) {
    OK(200), NOT_FOUND(404), ERROR(500)
}

data class Vec2(val x: Float, val y: Float) {
    fun add(other: Vec2) = Vec2(x + other.x, y + other.y)
    fun scale(s: Float)  = Vec2(x * s, y * s)
    fun dot(other: Vec2) = x * other.x + y * other.y
    fun length()         = Math.sqrt((x * x + y * y).toDouble()).toFloat()
}

data class Rect(val x: Float, val y: Float, val width: Float, val height: Float)

open class Animal(val name: String) {
    open fun speak(): String = "..."
    fun describe(): String   = "$name says ${speak()}"
}

class Dog(name: String) : Animal(name) {
    override fun speak() = "Woof"
}

object AppConfig {
    val version = "1.0.0"
    fun load(): AppConfig = AppConfig
}
