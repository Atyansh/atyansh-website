---
problemNumber: 53
title: 'Combinatoric Selections'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler53.py'
---

## Problem Statement

There are exactly ten ways of selecting three from five, 12345:

123, 124, 125, 134, 135, 145, 234, 235, 245, and 345

In combinatorics, we use the notation, C(5,3) = 10.

In general, C(n,r) = n! / (r!(n-r)!), where r ≤ n, n! = n×(n-1)×...×3×2×1, and 0! = 1.

It is not until n = 23, that a value exceeds one-million: C(23,10) = 1144066.

How many, not necessarily distinct, values of C(n,r) for 1 ≤ n ≤ 100, are greater than one-million?

## Approach

The solution involves:
1. Computing binomial coefficients C(n,r) for all valid combinations
2. Using dynamic programming (Pascal's triangle) for efficient computation
3. Counting values that exceed one million
4. Avoiding overflow by checking the threshold early
