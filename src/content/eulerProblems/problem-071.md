---
problemNumber: 71
title: 'Ordered Fractions'
difficulty: 10
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler71.java'
---

## Problem Statement

Consider the fraction, n/d, where n and d are positive integers. If n<d and HCF(n,d)=1, it is called a reduced proper fraction.

If we list the set of reduced proper fractions for d ≤ 8 in ascending order of size, we get:

1/8, 1/7, 1/6, 1/5, 1/4, 2/7, 1/3, 3/8, 2/5, 3/7, 1/2, 4/7, 3/5, 5/8, 2/3, 5/7, 3/4, 4/5, 5/6, 6/7, 7/8

It can be seen that 2/5 is the fraction immediately to the left of 3/7.

By listing the set of reduced proper fractions for d ≤ 1,000,000 in ascending order of size, find the numerator of the fraction immediately to the left of 3/7.

## Approach

The solution involves:
1. Finding the largest fraction n/d < 3/7 where d ≤ 1,000,000
2. Using the Farey sequence properties or mediant approach
3. For each denominator d, computing n = floor((3*d - 1) / 7)
4. Checking if n/d is in lowest terms and closer to 3/7 than previous candidates
5. Tracking the best fraction found
