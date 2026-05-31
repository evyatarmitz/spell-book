-- Haskell example — Code Scavenge test file
module Main where

import Data.List (sortBy)
import Data.Ord  (comparing)

-- ── Type aliases ──────────────────────────────────────────────

type Vec2     = (Float, Float)
type Matrix2  = ((Float, Float), (Float, Float))
type Predicate a = a -> Bool

-- ── Newtypes ──────────────────────────────────────────────────

newtype Name    = Name String
newtype Wrapped a = Wrap { unwrap :: a }

-- ── ADTs ──────────────────────────────────────────────────────

data Direction = North | South | East | West
    deriving (Show, Eq, Ord, Enum, Bounded)

data Shape
    = Circle Float
    | Rectangle Float Float
    | Triangle Float Float Float
    deriving Show

data Tree a
    = Leaf
    | Node a (Tree a) (Tree a)
    deriving Show

-- ── Typeclasses ───────────────────────────────────────────────

class Describable a where
    describe :: a -> String

class Container f where
    empty  :: f a
    insert :: a -> f a -> f a

-- ── Functions ─────────────────────────────────────────────────

clamp :: Ord a => a -> a -> a -> a
clamp lo hi = max lo . min hi

lerp :: Float -> Float -> Float -> Float
lerp a b t = a + (b - a) * t

vec2Add :: Vec2 -> Vec2 -> Vec2
vec2Add (x1, y1) (x2, y2) = (x1 + x2, y1 + y2)

vec2Scale :: Float -> Vec2 -> Vec2
vec2Scale s (x, y) = (s * x, s * y)

vec2Dot :: Vec2 -> Vec2 -> Float
vec2Dot (x1, y1) (x2, y2) = x1 * x2 + y1 * y2

vec2Length :: Vec2 -> Float
vec2Length (x, y) = sqrt (x * x + y * y)

area :: Shape -> Float
area (Circle r)        = pi * r * r
area (Rectangle w h)   = w * h
area (Triangle a b c)  = let s = (a + b + c) / 2
                          in sqrt (s * (s-a) * (s-b) * (s-c))

treeInsert :: Ord a => a -> Tree a -> Tree a
treeInsert x Leaf = Node x Leaf Leaf
treeInsert x (Node y left right)
    | x < y    = Node y (treeInsert x left) right
    | x > y    = Node y left (treeInsert x right)
    | otherwise = Node y left right
