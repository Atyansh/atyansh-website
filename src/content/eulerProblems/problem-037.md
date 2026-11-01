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

This one is in Python 2. I walk the odd numbers upward from 11 and, for each prime, check both truncation directions. The problem says there are exactly eleven, so the loop stops once it has found them all.

- **Right truncation:** repeatedly divide by 10 (integer division in Python 2) and test each shorter number. This loop also counts the digits in `rev`.
- **Left truncation:** remove the leading digit with `num - (num / 10**(rev-1)) * 10**(rev-1)`, which is `num % 10**(rev-1)`, and test what remains.

`isPrime` is trial division by odd numbers up to √n and returns False for 1, so a truncation that ends in a bare 1 is rejected.
