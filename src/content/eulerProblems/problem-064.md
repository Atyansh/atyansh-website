---
problemNumber: 64
title: 'Odd Period Square Roots'
difficulty: 20
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler64.py'
---

## Problem Statement

All square roots are periodic when written as continued fractions and can be written in the form:

√N = a₀ + 1/(a₁ + 1/(a₂ + 1/(a₃ + ... )))

For example, √23 = [4;(1,3,1,8)] where (1,3,1,8) repeats. The period is 4.

It can be seen that the sequence is repeating. For conciseness, we use the notation √23 = [4;(1,3,1,8)], to indicate that the block (1,3,1,8) repeats indefinitely.

Exactly four continued fractions, for N ≤ 13, have an odd period.

How many continued fractions for N ≤ 10000 have an odd period?

## Approach

The solution involves:
1. Implementing the continued fraction algorithm for square roots
2. Detecting when the sequence starts repeating (cycle detection)
3. Computing the period length
4. Counting numbers with odd period length
5. Skipping perfect squares which have no period
