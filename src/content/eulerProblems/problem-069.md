---
problemNumber: 69
title: 'Totient Maximum'
difficulty: 10
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler69.java'
---

## Problem Statement

Euler's Totient function, φ(n) [sometimes called the phi function], is used to determine the number of numbers less than n which are relatively prime to n. For example, as 1, 2, 4, 5, 7, and 8, are all less than nine and relatively prime to nine, φ(9)=6.

| n | Relatively Prime | φ(n) | n/φ(n) |
|---|-----------------|------|--------|
| 2 | 1               | 1    | 2      |
| 3 | 1,2             | 2    | 1.5    |
| 4 | 1,3             | 2    | 2      |
| 5 | 1,2,3,4         | 4    | 1.25   |
| 6 | 1,5             | 2    | 3      |
| 7 | 1,2,3,4,5,6     | 6    | 1.1666...  |
| 8 | 1,3,5,7         | 4    | 2      |
| 9 | 1,2,4,5,7,8     | 6    | 1.5    |
| 10| 1,3,7,9         | 4    | 2.5    |

It can be seen that n=6 produces a maximum n/φ(n) for n ≤ 10.

Find the value of n ≤ 1,000,000 for which n/φ(n) is a maximum.

## Approach

The solution involves:
1. Recognizing that n/φ(n) is maximized when n has many small prime factors
2. The answer is the product of consecutive primes: 2 × 3 × 5 × 7 × 11 × 13 × 17
3. Finding the largest primorial (product of consecutive primes) ≤ 1,000,000
4. Alternatively, computing φ(n) for all n and finding the maximum ratio
