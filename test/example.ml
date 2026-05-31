(* OCaml example — Code Scavenge test file *)

(* ── Type definitions ─────────────────────────────────────── *)

type direction = North | South | East | West

type 'a tree =
  | Leaf
  | Node of { value: 'a; left: 'a tree; right: 'a tree }

type vec2 = { x: float; y: float }

type shape =
  | Circle    of float
  | Rectangle of float * float
  | Triangle  of float * float * float

(* ── Module ──────────────────────────────────────────────── *)

module Vec2 = struct
  let make x y = { x; y }
  let zero     = { x = 0.0; y = 0.0 }

  let add a b  = { x = a.x +. b.x; y = a.y +. b.y }
  let scale s v = { x = s *. v.x;   y = s *. v.y }
  let dot a b  = a.x *. b.x +. a.y *. b.y
  let length v = sqrt (v.x *. v.x +. v.y *. v.y)

  let normalized v =
    let len = length v in
    if len > 0.0 then scale (1.0 /. len) v else zero
end

module MathUtils = struct
  let clamp value lo hi = max lo (min hi value)
  let lerp a b t = a +. (b -. a) *. t
  let sigmoid x = 1.0 /. (1.0 +. exp (-. x))
end

(* ── Class ───────────────────────────────────────────────── *)

class stack = object
  val mutable items : int list = []
  method push x    = items <- x :: items
  method pop       = match items with [] -> None | h :: t -> items <- t; Some h
  method peek      = match items with [] -> None | h :: _ -> Some h
  method is_empty  = items = []
end

(* ── Functions ───────────────────────────────────────────── *)

let clamp value lo hi = max lo (min hi value)

let rec factorial n =
  if n <= 1 then 1
  else n * factorial (n - 1)

let area = function
  | Circle r        -> Float.pi *. r *. r
  | Rectangle (w,h) -> w *. h
  | Triangle (a,b,c)->
      let s = (a +. b +. c) /. 2.0 in
      sqrt (s *. (s-.a) *. (s-.b) *. (s-.c))

let rec tree_insert x = function
  | Leaf -> Node { value = x; left = Leaf; right = Leaf }
  | Node { value = y; left; right } ->
      if x < y then Node { value = y; left = tree_insert x left; right }
      else if x > y then Node { value = y; left; right = tree_insert x right }
      else Node { value = y; left; right }
