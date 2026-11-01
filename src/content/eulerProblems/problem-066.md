---
problemNumber: 66
title: 'Diophantine Equation'
difficulty: 25
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler66.py'
---

## The problem

For each non-square D ≤ 1000, take the solution of x² − Dy² = 1 in positive integers with the smallest x. Find the D for which that minimal x is largest.

## My solution

This is Pell's equation, and its minimal solution is always one of the convergents h/k of the continued fraction of √D. The script uses the same expansion code as my Problem 64 solution to collect one period of partial quotients (a dict of seen states detects the repeat), drops a₀, and then generates convergents with the standard recurrence

- hₙ = aₙ·hₙ₋₁ + hₙ₋₂
- kₙ = aₙ·kₙ₋₁ + kₙ₋₂

starting from h = a₀, k = 1. It keeps going, wrapping around the period as many times as needed, until h² − Dk² = 1, and tracks the D with the largest x so far.

```python
while diophantine != 0:
  tempX = x
  tempY = y

  x = (x * list[index]) + prevX
  y = (y * list[index]) + prevY

  index += 1
  if index >= len(list):
    index = 0

  prevX = tempX
  prevY = tempY

  diophantine = x * x - i * y * y - 1
```

Python's big integers matter here: the largest minimal x for D ≤ 1000 has 38 digits. The whole run takes a few hundredths of a second.

## Notes

The wrap-around is needed. If the period length r is even, the minimal solution is the convergent at the end of the first period, but if r is odd, that convergent solves x² − Dy² = −1, and the answer only comes at the end of the second period.
