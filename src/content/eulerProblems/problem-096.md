---
problemNumber: 96
title: 'Su Doku'
difficulty: 25
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler96.py'
---

## The problem

Solve fifty Sudoku puzzles from a file. For each solved grid, read the first three cells of the top row as a 3-digit number, and add up those fifty numbers.

## My solution

I came back to this one in 2016, about a year and a half after my other solutions. Sudoku is NP-complete, so rather than write a backtracking solver, I reduced it to Boolean satisfiability and handed it to an off-the-shelf SAT solver (`pycosat`, the Python bindings for PicoSAT).

**Variables.** One boolean per (row i, column j, digit k), numbered `n⁴·i + n²·j + k`. With n = 3, that's 81i + 9j + k, covering 1 to 729.

**Clauses.** The same "exactly one" pattern is applied to four groups of 9 variables:

- each cell holds some digit,
- each digit appears in each row,
- each digit appears in each column,
- each digit appears in each 3×3 box.

"Exactly one" is one clause listing all 9 variables (at least one), plus a two-literal clause ¬x ∨ ¬y for every pair (at most one), generated with `itertools.combinations`:

```python
for k in range(1, sq + 1):
  ks.append(mapping(i,j,k))
  nks.append(0-mapping(i,j,k))
clauses.append(ks)
nxs = itertools.combinations(nks, 2)
for nx in nxs:
  clauses.append(nx)
```

That's 324 groups × (1 + 36) = 11,988 clauses, plus one unit clause per given digit. `pycosat.solve` returns the satisfying assignment as a list of signed literals. I turn it into a set and read each cell back as the k whose variable is true.

The puzzle file has a "Grid NN" header followed by 9 rows, so the main loop steps through it 10 lines at a time, and `getBoard` skips the header. The encoding itself is written in terms of n (block size) and n² (board size), so it isn't tied to 9×9, although the file parsing is. The script is Python 2 and expects the puzzles in `Euler96.txt`, which isn't committed to the repo.

## Notes

This is the fully redundant encoding, with "exactly one" on cells as well as on every row, column and box. Strictly fewer clauses would do (for example, "at least one" per cell plus "at most one" per unit), but the redundant clauses are a common choice because they give the solver more to propagate.
