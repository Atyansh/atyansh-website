---
problemNumber: 53
title: 'Combinatoric Selections'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler53.py'
---

## The problem

Count how many of the binomial coefficients C(n, r), for 1 ≤ n ≤ 100, are greater than one million.

## My solution

Straight from the definition C(n, r) = n! / (r!·(n − r)!), using Python's big integers. A list holds the factorials 1! through 100! (index k − 1 holds k!, filled by a recursive `fact`), and the code evaluates every C(n, r) with 1 ≤ r ≤ n ≤ 100, counting those over 10⁶.

```python
def comb(n, r):
  return list[n-1]/list[n-r-1]/list[r-1]
```

There's no Pascal's triangle, symmetry, or early exit. It computes all 5,050 values directly, which takes a few hundredths of a second. The file is Python 2, so `/` is integer division and `print count` is a statement.

## Notes

When r = n, `list[n-r-1]` becomes `list[-1]`, which Python reads as the last element (100!) rather than 0! = 1. So C(n, n) comes out as 0 instead of 1. That never matters, because 1 is nowhere near a million.
