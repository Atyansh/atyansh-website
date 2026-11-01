---
title: 'A Domain-Specific Language for Constructing and Reasoning About the Security of Garbled Circuits'
description: 'A Haskell embedded DSL that builds Boolean circuits as a free monad and garbles them with a typed, step-by-step interpreter.'
authors: ['Matthew Chan', 'Rohit Jha', 'Atyansh Jaiswal']
pubDate: 2016-12-15
featured: true
tags: ['garbled circuits', 'secure computation', 'Haskell', 'DSL', 'cryptography']
links:
  pdf: '/papers/gc.pdf'
---

## The problem

Garbled circuits let one party encrypt a Boolean circuit so that someone else can evaluate it and learn only the final output, not the inputs or any intermediate wire values. The idea is decades old, but at the time of the paper it had few easy-to-use implementations. This project asks whether a small typed language in Haskell can make circuits easy to write and make the garbling steps clear enough to reason about.

The paper considers two semi-honest settings:

- **Outsourced computation:** Alice garbles a function and her inputs, a cloud server evaluates them, and only Alice can decode the result.
- **Two-party computation:** Alice garbles a secret function and her input, and Bob evaluates it on his own input, which he would get through oblivious transfer.

## The circuit language

Circuits are an embedded DSL built with the **free monad** idiom. The only thing defined by hand is a functor describing a single gate, and `Free` turns it into a language of circuits:

```haskell
data Gate a
  = And Bool Bool (Bool -> a)
  | Or  Bool Bool (Bool -> a)
  | Const Bool a
  deriving Functor

type Circuit = Free Gate
```

A circuit is then ordinary `do`-notation:

```haskell
circuit a1 a2 b1 b2 = do
  gateAout <- and a1 b2
  gateBout <- and b1 b2
  gateCout <- or gateAout gateBout
  return gateCout
```

A purely shallow embedding would have been simpler, but it would not keep a syntax tree that can be inspected or reinterpreted. With the free monad, garbling and evaluation are just interpreters, and garbling a whole circuit is a monadic traversal. The paper also discusses free applicatives as an alternative. Because applicative computations cannot depend on earlier results, they allow static analysis. This was not implemented.

## Garbling a gate

Garbling follows the Fairplay system, using a single AND gate as the example:

1. **Initialization.** For each wire k, generate a random permutation bit pₖ and two 80-bit random keys, one for 0 and one for 1. Combining each key with its bit value and pₖ gives the two wire labels wₖ⁰ and wₖ¹.
2. **Garbled truth table (GTT).** Replace every 0 and 1 in the gate's truth table with the matching wire label, and keep a lookup table from output labels back to Booleans.
3. **Encrypted GTT.** Hash the input labels with SHA-1, together with the wire index and the row's input bits, then XOR both input hashes into the output label. Whoever holds the right pair of input labels can recover exactly one output label.
4. **Permutation.** Shuffle the rows so that a row's position reveals nothing.

The stateful parts (randomness, the map from wires to keys, and errors) live in a `Garbled` monad built from `RandT`, `StateT` and `ExceptT`. Each step is a Kleisli arrow, so the whole pipeline is:

```haskell
garble :: TT Bool -> Garbled (GarbledTT HashedBS)
garble = gtt >=> egtt >=> pegtt
```

The paper notes that giving these steps precise types caught mistakes in the authors' own understanding, in the implementation, and in the math as written in several papers.

Evaluating a gate (`eval :: GarbledTT HashedBS -> Bool -> Bool -> Maybe Bool`) encodes the inputs, finds the matching row, removes the hashes with XOR to recover the output label, and maps that label back to a Boolean with the lookup table. In multi-gate circuits each gate is garbled and evaluated separately, and each gate's output is decoded before it is passed to the next gate.

## Correctness and security

- **Correctness** is stated as a commutative diagram, in the style of Hutton's work on compiler correctness: evaluating the plain truth table and evaluating the garbled table must give the same result. The paper argues this from the definition of garbling. It leaves a proof by program calculation as future work.
- **Security** is argued informally against the privacy, obliviousness and authenticity definitions from Bellare, Hoang and Rogaway's "Foundations of Garbled Circuits". For example, for authenticity, an evaluator would have to guess one of only two valid 80-bit output labels.

## How it was evaluated

The DSL was tested on circuits made of single Boolean gates such as AND, and produced correct results. There are no performance measurements or larger benchmark circuits.

## Limitations the paper states

- Oblivious transfer is not implemented, so the system is not yet a full two-party protocol.
- The table permutation uses a random shuffle instead of the permutation-bit row swaps described in Fairplay.
- The correctness proof by program calculation is not done.
- Future work includes oblivious transfer and a communication layer (possibly using session types), protocol verification with refinement types, and the optimized garbling and evaluation schemes from later work.
