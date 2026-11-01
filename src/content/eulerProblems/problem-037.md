---
problemNumber: 37
title: 'Truncatable Primes'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler37.py'
---

## The problem

Some primes stay prime as you remove digits one at a time from the left, and also from the right. There are only eleven of them (2, 3, 5 and 7 don't count); find their sum.

## My solution

This is Python 2. I walk the odd numbers upward from 11 and, for each prime, check both truncation directions. The loop stops once eleven have been found, so it relies on the problem's statement that there are exactly eleven rather than on a bound of its own.

- **Right truncation:** repeatedly divide by 10 (integer division in Python 2) and test each shorter number. This loop also counts the digits in `rev`.
- **Left truncation:** remove the leading digit with `num - (num / 10**(rev-1)) * 10**(rev-1)`, which is `num % 10**(rev-1)`, and test what remains.

`isPrime` is trial division by odd numbers up to √n and returns False for 1, so a truncation that ends in a bare 1 is rejected. A failed check only sets `flag = False`; the loops keep going rather than stopping early, which wastes a little time.

Python 2 isn't installed on my current machine, but a Python 3 port (changing `/` to `//` and `print` to a function) runs in about 1.4 seconds.

## Notes

As written it won't run under Python 3: besides the `print` statement, `/` would produce floats and the truncations would be wrong.
