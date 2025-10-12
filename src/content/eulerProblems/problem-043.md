---
problemNumber: 43
title: 'Sub-string Divisibility'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler43.java'
---

## Problem Statement

The number, 1406357289, is a 0 to 9 pandigital number because it is made up of each of the digits 0 to 9 in some order, but it also has a rather interesting sub-string divisibility property.

Let d(1) be the 1st digit, d(2) be the 2nd digit, and so on. In this way, we note the following:

- d(2)d(3)d(4) = 406 is divisible by 2
- d(3)d(4)d(5) = 063 is divisible by 3
- d(4)d(5)d(6) = 635 is divisible by 5
- d(5)d(6)d(7) = 357 is divisible by 7
- d(6)d(7)d(8) = 572 is divisible by 11
- d(7)d(8)d(9) = 728 is divisible by 13
- d(8)d(9)d(10) = 289 is divisible by 17

Find the sum of all 0 to 9 pandigital numbers with this property.

## Approach

The solution involves:
1. Generating all 0-9 pandigital permutations
2. For each permutation, checking the divisibility constraints
3. Using the constraints to prune the search space efficiently
4. Summing all numbers that satisfy all divisibility properties
