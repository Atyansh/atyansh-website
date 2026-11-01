---
problemNumber: 63
title: 'Powerful Digit Counts'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler63.py'
---

## The problem

Count the positive integers that have exactly n digits and are also an nth power.

## My solution

Check every base from 1 to 9 against every exponent from 1 to 21, counting the cases where `m**n` has exactly n digits:

```python
for n in range(1, 22):
  for m in range(1, 10):
    value = m**n

    if len(str(value)) == n:
      counter += 1
```

Both bounds are tight. The base can't be 10 or more, because 10ⁿ already has n + 1 digits. For the exponent, 9ⁿ has ⌊n·log₁₀9⌋ + 1 ≈ ⌊0.954n⌋ + 1 digits, which equals n only up to n = 21 and falls behind from n = 22 on. Smaller bases fall behind sooner. So 189 checks cover every case, and the script runs instantly. It's Python 2 (`print counter`).
