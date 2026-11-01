---
problemNumber: 75
title: 'Singular Integer Right Triangles'
difficulty: 25
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler75.py'
---

## The problem

A wire of length L can sometimes be bent into an integer-sided right triangle. Count the lengths L ≤ 1,500,000 for which there is exactly one such triangle.

## My solution

I generate triangles with Euclid's formula, a = 2mn, b = m² − n², c = m² + n² for m > n ≥ 1, swap a and b so the smaller leg comes first, and record perimeters in a dict `d` from perimeter to triangle count.

I don't filter (m, n) for coprimality or opposite parity. Duplicates are handled with a second dict, `done`, of every triangle already counted. When a new triangle appears, I add 1 to the count of every multiple of its perimeter up to L and mark each scaled copy (k·a, k·b, k·c) as done:

```python
if (a,b,c) in done:
  n += 1
  continue

pro = nSum
ct = 1
while(pro <= L):
  d[pro] += 1
  done[(ct*a,ct*b,ct*c)] = 1
  pro += nSum
  ct += 1
```

This avoids double counting because Euclid's formula produces every primitive triple, and every non-primitive triple it produces (m and n both odd, or sharing a factor) is a multiple of a primitive one with a smaller m. Since m only increases, the primitive triple always comes first and has already marked its multiples.

The outer loop stops once the smallest perimeter for m (n = 1, giving 2m² + 2m) passes L, and the inner loop stops once 2m(m + n) passes L. At the end I count the perimeters with exactly one triangle.

It's Python 2 (`print answer`). Converted to Python 3, it runs in about 1.4 seconds.

## Notes

The `done` dict ends up holding a tuple for every triangle with perimeter up to 1.5 million. The usual alternative is to generate only coprime, opposite-parity (m, n), which yields each primitive triple exactly once and needs no bookkeeping.
