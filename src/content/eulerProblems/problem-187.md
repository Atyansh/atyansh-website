---
problemNumber: 187
title: 'Semiprimes'
difficulty: 25
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler187.java'
---

## Problem Statement

A composite is a number containing at least two prime factors. For example, 15 = 3 × 5; 9 = 3 × 3; 12 = 2 × 2 × 3.

There are ten composites below thirty containing precisely two, not necessarily distinct, prime factors: 4, 6, 9, 10, 14, 15, 21, 22, 25, 26.

How many composite integers, n < 10⁸, have precisely two, not necessarily distinct, prime factors?

## Approach

The solution involves:
1. Generating all primes up to 10⁸/2 using Sieve of Eratosthenes
2. Counting semiprimes of the form p × q where p and q are primes
3. For each prime p, counting primes q where p ≤ q and p × q < 10⁸
4. Using two pointers or binary search for efficient counting
5. Semiprimes include both p² (same prime twice) and p × q (different primes)
