---
problemNumber: 80
title: 'Square Root Digital Expansion'
difficulty: 20
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler80.py'
---

## Problem Statement

It is well known that if the square root of a natural number is not an integer, then it is irrational. The decimal expansion of such square roots is infinite without any repeating pattern at all.

The square root of two is 1.41421356237309504880..., and the digital sum of the first one hundred decimal digits is 475.

For the first one hundred natural numbers, find the total of the digital sums of the first one hundred decimal digits for all the irrational square roots.

## Approach

The solution involves:
1. For each number from 1 to 100, checking if it's a perfect square
2. For non-perfect squares, computing the square root to 100+ decimal digits
3. Using BigDecimal with high precision for accurate computation
4. Extracting the first 100 digits (including the integer part)
5. Summing the digits for each irrational square root
6. Computing the total sum across all irrational square roots
