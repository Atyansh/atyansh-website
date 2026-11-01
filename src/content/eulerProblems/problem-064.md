---
problemNumber: 64
title: 'Odd Period Square Roots'
difficulty: 20
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler64.py'
---

## The problem

The continued fraction of √N is periodic for every non-square N. Count how many N ≤ 10,000 have a period of odd length.

## My solution

The partial quotients come from the standard integer recurrence for √N. Starting from d = 1 and m = a = ⌊√N⌋, each step does:

- d ← (N − m²) / d
- a ← ⌊(√N + m) / d⌋
- m ← a·d − m

In the code `num` is d, `den` is m and `n` is a. Everything is integer arithmetic except the floor, which uses the floating-point √N (accurate enough at this size).

To find the period, each state (a, d, m) is stored in a dict until one repeats. The starting state (a₀, 1, a₀) never comes back. Its (d, m) pair does reappear at the end of every period, but with a = 2a₀ instead of a₀, and keying on a as well keeps the two apart. So the dict ends up holding a₀ plus exactly one period, and the period is odd exactly when the dict's size is even:

```python
while t not in set:
  set[t] = 1

  num = (i - (den*den))/num
  n = int((sq + den) / num)
  den = n * num - den

  t = (n,(num, den))

if len(set) % 2 == 0:
  answer += 1
```

The file is Python 2 (it relies on `/` being integer division). Ported to Python 3 it takes about 0.2 seconds for all N up to 10,000.
