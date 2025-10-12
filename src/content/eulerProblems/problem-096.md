---
problemNumber: 96
title: 'Su Doku'
difficulty: 25
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler96.py'
---

# Problem 96: Su Doku

## Problem Statement

Su Doku (Japanese meaning "number place") is the name given to a popular puzzle concept. Its origin is unclear, but credit must be attributed to Leonhard Euler who invented a similar, and much more difficult, puzzle concept called Latin Squares.

The objective of Su Doku puzzles is to replace the blanks in a 9×9 grid with digits 1-9 so that each row, column, and 3×3 box contains each number exactly once.

A well-constructed Su Doku puzzle has a unique solution and can be solved by logic alone. For this problem, there is a text file containing fifty different Su Doku puzzles ranging in difficulty, but all with unique solutions.

**By solving all fifty puzzles, find the sum of the 3-digit numbers found in the top left corner of each solution grid.**

For example, the puzzle below contains 483 in the top left corner.

## Solution Approach: SAT Solver

This problem is particularly interesting because it can be elegantly solved using a **Boolean Satisfiability (SAT) solver**. A Sudoku puzzle can be encoded as a SAT problem by representing constraints as boolean clauses.

### SAT Encoding Strategy

1. **Variables**: Create boolean variables for each possible digit in each cell
   - Variable `V(r,c,d)` = true if row r, column c contains digit d
   - Total: 9 × 9 × 9 = 729 boolean variables

2. **Constraints as Clauses**:
   - **Cell constraint**: Each cell contains exactly one digit
   - **Row constraint**: Each digit appears exactly once in each row
   - **Column constraint**: Each digit appears exactly once in each column
   - **Box constraint**: Each digit appears exactly once in each 3×3 box
   - **Given clues**: Pre-filled cells are fixed to their values

3. **SAT Solver**: Use a DPLL or CDCL-based SAT solver to find a satisfying assignment

### Why SAT Solvers Excel at Sudoku

- Sudoku is NP-complete, but SAT solvers are highly optimized for similar problems
- Modern SAT solvers use sophisticated techniques:
  - Conflict-driven clause learning (CDCL)
  - Unit propagation
  - Intelligent backtracking
  - Learned clauses to prune search space

- For well-formed Sudoku puzzles, SAT solvers typically find solutions in milliseconds

### Implementation Highlights

The SAT-based approach transforms the 50 Sudoku puzzles into CNF (Conjunctive Normal Form) and uses a SAT solver to efficiently find all solutions. After solving each puzzle, extract the 3-digit number from the top-left corner and sum them.

## Complexity

- **Encoding**: O(n⁴) where n=9 (generating all clauses)
- **Solving**: Depends on SAT solver; modern solvers are very efficient for Sudoku
- **Space**: O(n³) for storing variables and clauses

## Alternative Approaches

1. **Backtracking with Constraint Propagation**: Classic approach using recursive backtracking
2. **Dancing Links (DLX)**: Knuth's Algorithm X for exact cover problems
3. **Brute Force with Pruning**: Try all possibilities with early termination

## Why This Problem Is Special

- Demonstrates how constraint satisfaction problems map to SAT
- Shows practical application of theorem provers to puzzle solving
- Illustrates the power of modern SAT solver technology
- Combines logic, algorithms, and formal methods

## Related Concepts

- Boolean Satisfiability (SAT)
- Constraint Satisfaction Problems (CSP)
- NP-completeness
- DPLL and CDCL algorithms
- Exact cover problems
- Latin Squares

## Problem Link

View the full problem on [Project Euler](https://projecteuler.net/problem=96).
