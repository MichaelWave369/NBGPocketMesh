import Lean

set_option warningAsError true

namespace PhiNullMesh.R7

universe u v w z
def compose {A : Type u} {B : Type v} {C : Type w}
    (g : B → C) (f : A → B) : A → C := fun x => g (f x)

theorem composition_assoc {A : Type u} {B : Type v}
    {C : Type w} {D : Type z} (f : A → B) (g : B → C) (h : C → D) :
    compose h (compose g f) = compose (compose h g) f := rfl

theorem identity_left {A : Type u} {B : Type v} (f : A → B) :
    compose (fun b : B => b) f = f := rfl

theorem identity_right {A : Type u} {B : Type v} (f : A → B) :
    compose f (fun a : A => a) = f := rfl

-- A and B can be maps between different types (rectangular-map analogue).
-- Only the inverse law used at the intermediate interface is required.
theorem reframe_gluing {A : Type u} {B : Type v} {B' : Type w}
    {C : Type z} (f : A → B) (g : B → C)
    (t : B → B') (ti : B' → B) (leftInv : ∀ b, ti (t b) = b) :
    compose (compose g ti) (compose t f) = compose g f := by
  funext x
  change g (ti (t (f x))) = g (f x)
  rw [leftInv]

theorem reframe_roundtrip {A : Type u} {B : Type v} {B' : Type w}
    (f : A → B) (t : B → B') (ti : B' → B)
    (leftInv : ∀ b, ti (t b) = b) :
    compose ti (compose t f) = f := by
  funext x
  change ti (t (f x)) = f x
  exact leftInv (f x)

-- Each step consumes one frame label. The map supplied by the caller
-- is total; graph membership and bounded arithmetic are not modeled.
def pathEnd {V : Type u} (start : V) (rest : List V) : V :=
  match rest with
  | [] => start
  | v :: tail => pathEnd v tail

def runPath {V : Type u} {X : Type v} (T : V → V → X → X)
    (start : V) (rest : List V) (x : X) : X :=
  match rest with
  | [] => x
  | v :: tail => runPath T v tail (T start v x)

-- q may be a squared norm or any scalar-valued quantity.
-- Edge preservation is an explicit hypothesis, not an inferred metric law.
theorem path_conservation {V : Type u} {X : Type v} {R : Type w}
    (T : V → V → X → X) (q : V → X → R)
    (preserves : ∀ a b x, q b (T a b x) = q a x)
    (start : V) (rest : List V) (x : X) :
    q (pathEnd start rest) (runPath T start rest x) = q start x := by
  induction rest generalizing start x with
  | nil => rfl
  | cons v tail ih =>
    change q (pathEnd v tail) (runPath T v tail (T start v x)) = q start x
    calc
      _ = q v (T start v x) := ih v (T start v x)
      _ = q start x := preserves start v x

-- P maps root coordinates to a frame; Q maps back.
-- These assumptions are the functional analogue of R2 root potentials.
theorem potential_path {V : Type u} {X : Type v}
    (T : V → V → X → X) (P Q : V → X → X)
    (leftInv : ∀ a x, Q a (P a x) = x)
    (rightInv : ∀ a x, P a (Q a x) = x)
    (edgeLaw : ∀ a b x, T a b x = P b (Q a x))
    (start : V) (rest : List V) (x : X) :
    runPath T start rest x = P (pathEnd start rest) (Q start x) := by
  induction rest generalizing start x with
  | nil =>
    change x = P start (Q start x)
    exact (rightInv start x).symm
  | cons v tail ih =>
    change runPath T v tail (T start v x) = P (pathEnd v tail) (Q start x)
    calc
      _ = P (pathEnd v tail) (Q v (T start v x)) := ih v (T start v x)
      _ = P (pathEnd v tail) (Q start x) := by
        rw [edgeLaw start v x, leftInv v (Q start x)]

theorem closed_path_identity {V : Type u} {X : Type v}
    (T : V → V → X → X) (P Q : V → X → X)
    (leftInv : ∀ a x, Q a (P a x) = x)
    (rightInv : ∀ a x, P a (Q a x) = x)
    (edgeLaw : ∀ a b x, T a b x = P b (Q a x))
    (start : V) (rest : List V) (closed : pathEnd start rest = start) :
    (fun x => runPath T start rest x) = (fun x => x) := by
  funext x
  calc
    _ = P (pathEnd start rest) (Q start x) :=
      potential_path T P Q leftInv rightInv edgeLaw start rest x
    _ = x := by rw [closed, rightInv start x]

-- Even reversible functions need not commute. Two transpositions on
-- Finite three-element values: swap 0/1 and swap 1/2.
inductive Three where
  | a | b | c

def swapAB : Three → Three
  | .a => .b
  | .b => .a
  | .c => .c

def swapBC : Three → Three
  | .a => .a
  | .b => .c
  | .c => .b

theorem reversible_noncommutativity :
    (∀ x, swapAB (swapAB x) = x) ∧
    (∀ x, swapBC (swapBC x) = x) ∧
    compose swapAB swapBC ≠ compose swapBC swapAB := by
  constructor
  · intro x
    cases x <;> rfl
  constructor
  · intro x
    cases x <;> rfl
  · intro h
    have bad := congrFun h Three.a
    change Three.b = Three.c at bad
    cases bad

#print axioms composition_assoc
#print axioms identity_left
#print axioms identity_right
#print axioms reframe_gluing
#print axioms reframe_roundtrip
#print axioms path_conservation
#print axioms potential_path
#print axioms closed_path_identity
#print axioms reversible_noncommutativity

end PhiNullMesh.R7
