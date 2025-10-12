---
problemNumber: 72
title: 'Counting Fractions'
difficulty: 20
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler72.java'
---

## Problem Statement

Consider the fraction, n/d, where n and d are positive integers. If n<d and HCF(n,d)=1, it is called a reduced proper fraction.

If we list the set of reduced proper fractions for d ≤ 8 in ascending order of size, we get:

1/8, 1/7, 1/6, 1/5, 1/4, 2/7, 1/3, 3/8, 2/5, 3/7, 1/2, 4/7, 3/5, 5/8, 2/3, 5/7, 3/4, 4/5, 5/6, 6/7, 7/8

It can be seen that there are 21 elements in this set.

How many elements would be contained in the set of reduced proper fractions for d ≤ 1,000,000?

## Approach

The solution involves:
1. Recognizing that the count equals the sum of Euler's totient function φ(d) for d from 2 to 1,000,000
2. For each denominator d, φ(d) counts fractions with that denominator
3. Computing φ(d) efficiently for all d using a sieve-like approach
4. Summing all φ(d) values
