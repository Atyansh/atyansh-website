---
problemNumber: 97
title: 'Large Non-Mersenne Prime'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler97.py'
---

## The problem

Find the last ten digits of the prime 28433 × 2⁷⁸³⁰⁴⁵⁷ + 1, which has over 2.3 million digits.

## My solution

The whole thing is three lines of Python 2, and it computes the full number:

```python
a = 28433*(2**7830457)

print a+1
```

Python's integers have arbitrary precision, so this simply builds the entire 2,357,207-digit number and prints it. I read the last ten digits off the end of the output. There's no modular arithmetic involved.

The arithmetic itself is fast. Most of the running time goes into converting the 2.3-million-digit result to decimal for printing.
