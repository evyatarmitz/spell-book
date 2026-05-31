# Python example — Code Scavenge test file

def clamp(value, lo, hi):
    return max(lo, min(hi, value))


def lerp(a, b, t):
    return a + (b - a) * t


def flatten(nested):
    result = []
    for item in nested:
        if isinstance(item, list):
            result.extend(flatten(item))
        else:
            result.append(item)
    return result


class Vector2:
    def __init__(self, x=0.0, y=0.0):
        self.x = x
        self.y = y

    def add(self, other):
        return Vector2(self.x + other.x, self.y + other.y)

    def scale(self, factor):
        return Vector2(self.x * factor, self.y * factor)

    def dot(self, other) -> float:
        return self.x * other.x + self.y * other.y

    def length(self) -> float:
        return (self.x ** 2 + self.y ** 2) ** 0.5

    def __repr__(self):
        return f"Vector2({self.x}, {self.y})"


class Registry:
    def __init__(self):
        self._store = {}

    def register(self, key, value):
        self._store[key] = value

    def get(self, key, default=None):
        return self._store.get(key, default)

    def remove(self, key):
        self._store.pop(key, None)
