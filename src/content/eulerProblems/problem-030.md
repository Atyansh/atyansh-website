---
problemNumber: 30
title: 'Digit Fifth Powers'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler30.java'
---

## Problem Statement

Surprisingly there are only three numbers that can be written as the sum of fourth powers of their digits:

- 1634 = 1⁴ + 6⁴ + 3⁴ + 4⁴
- 8208 = 8⁴ + 2⁴ + 0⁴ + 8⁴
- 9474 = 9⁴ + 4⁴ + 7⁴ + 4⁴

As 1 = 1⁴ is not a sum it is not included.

The sum of these numbers is 1634 + 8208 + 9474 = 19316.

Find the sum of all the numbers that can be written as the sum of fifth powers of their digits.

## Approach

The solution involves:
1. Determining an upper bound for the search (6 × 9⁵ = 354,294)
2. For each number, extracting its digits and computing the sum of fifth powers
3. Checking if the sum equals the original number
4. Accumulating all such numbers (excluding 1)
