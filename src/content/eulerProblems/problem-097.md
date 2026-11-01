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

The arithmetic itself is fast (about 0.03 s). Nearly all of the time goes into converting the result to decimal for printing, because CPython's int-to-string conversion is quadratic in the number of digits. On Python 3.9 that conversion took about 78 seconds.

## Notes

- `pow(2, 7830457, 10**10)` does modular exponentiation and makes this instant: multiply by 28433, add 1 and reduce mod 10¹⁰.
- Python 3.11 and later refuse to convert integers longer than 4,300 digits to strings by default, so this approach now raises a `ValueError` unless you raise the limit with `sys.set_int_max_str_digits`.
