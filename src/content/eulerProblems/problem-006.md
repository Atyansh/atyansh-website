---
problemNumber: 6
title: 'Sum Square Difference'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler6.java'
---

## Problem Statement

The sum of the squares of the first ten natural numbers is:
1² + 2² + ... + 10² = 385

The square of the sum of the first ten natural numbers is:
(1 + 2 + ... + 10)² = 55² = 3025

Hence the difference between the square of the sum and the sum of the squares of the first ten natural numbers is 3025 - 385 = 2640.

Find the difference between the sum of the squares of the first one hundred natural numbers and the square of the sum.

## Approach

We can use mathematical formulas to solve this efficiently:

1. Sum of first n natural numbers: `n(n+1)/2`
2. Sum of squares of first n natural numbers: `n(n+1)(2n+1)/6`

For n = 100:
- Calculate sum = 100(101)/2, then square it
- Calculate sum of squares = 100(101)(201)/6
- Find the difference: (sum)² - sum of squares

This approach runs in O(1) time complexity, avoiding the need to iterate through all numbers.
