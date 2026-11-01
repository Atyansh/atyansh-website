---
problemNumber: 25
title: '1000-digit Fibonacci Number'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler25.py'
---

## The problem

Find the index of the first Fibonacci number (with F₁ = F₂ = 1) that has 1000 digits.

## My solution

Python integers are arbitrary precision, so I just step the sequence. `c` holds Fₙ, starting at F₃ = 2, and `n` tracks its index:

```python
while(c / (10**999) == 0):
  a = b
  b = c
  c = a + b
  n += 1
```

This is Python 2, where `/` on integers is floor division, so `c / 10**999 == 0` means `c < 10⁹⁹⁹`, i.e. `c` still has fewer than 1000 digits. That's a few thousand big-integer additions and finishes instantly.

## Notes

Since Fₙ ≈ φⁿ/√5, the index can also be computed directly with logarithms.
