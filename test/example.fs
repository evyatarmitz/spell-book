// F# example — Code Scavenge test file
module MathUtils

// ── Type aliases & discriminated unions ───────────────────────

type Predicate<'a> = 'a -> bool
type Matrix        = float[,]

type Direction = North | South | East | West

type Shape =
    | Circle    of radius: float
    | Rectangle of width: float * height: float
    | Triangle  of a: float * b: float * c: float

type Tree<'a> =
    | Leaf
    | Node of value: 'a * left: Tree<'a> * right: Tree<'a>

// ── Record types ─────────────────────────────────────────────

type Vec2 = { X: float; Y: float }
type Rect = { X: float; Y: float; Width: float; Height: float }

// ── Module ────────────────────────────────────────────────────

module Vec2 =
    let make x y    = { X = x; Y = y }
    let zero        = { X = 0.0; Y = 0.0 }
    let add a b     = { X = a.X + b.X; Y = a.Y + b.Y }
    let scale s v   = { X = s * v.X; Y = s * v.Y }
    let dot a b     = a.X * b.X + a.Y * b.Y
    let length v    = sqrt (v.X * v.X + v.Y * v.Y)
    let normalize v =
        let len = length v
        if len > 0.0 then scale (1.0 / len) v else zero

// ── Functions ─────────────────────────────────────────────────

let clamp value lo hi = max lo (min hi value)
let lerp a b t        = a + (b - a) * t
let sigmoid x         = 1.0 / (1.0 + exp (-x))

let rec factorial n =
    if n <= 1 then 1L
    else int64 n * factorial (n - 1)

let area shape =
    match shape with
    | Circle r        -> System.Math.PI * r * r
    | Rectangle (w,h) -> w * h
    | Triangle (a,b,c) ->
        let s = (a + b + c) / 2.0
        sqrt (s * (s-a) * (s-b) * (s-c))

// ── Class ─────────────────────────────────────────────────────

type Stack<'a>() =
    let mutable items : 'a list = []

    member this.Push x    = items <- x :: items
    member this.Pop ()    = match items with [] -> None | h :: t -> items <- t; Some h
    member this.Peek ()   = List.tryHead items
    member this.IsEmpty   = List.isEmpty items
    member this.Count     = List.length items

// ── Interface ─────────────────────────────────────────────────

type ISerializable =
    abstract member Serialize   : unit -> string
    abstract member Deserialize : string -> unit
