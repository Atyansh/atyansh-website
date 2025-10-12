---
problemNumber: 9
title: 'Special Pythagorean Triplet'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler9.java'
---

# Problem 9: Special Pythagorean Triplet

## Problem Statement

A Pythagorean triplet is a set of three natural numbers, $a < b < c$, for which, $a^2 + b^2 = c^2$.

For example, $3^2 + 4^2 = 9 + 16 = 25 = 5^2$.

There exists exactly one Pythagorean triplet for which $a + b + c = 1000$.

**Find the product $abc$.**

## Approach

This problem requires finding three natural numbers that satisfy two conditions:
1. They form a Pythagorean triplet: $a^2 + b^2 = c^2$
2. Their sum equals 1000: $a + b + c = 1000$

### Brute Force Approach
We can iterate through possible values of $a$ and $b$ and calculate $c$ from the sum constraint:
- For each $a$ from 1 to 1000
- For each $b$ from $a+1$ to 1000
- Calculate $c = 1000 - a - b$
- Check if $a^2 + b^2 = c^2$

### Optimized Approach
We can reduce the search space by noting that:
- Since $a < b < c$ and $a + b + c = 1000$, we know $a < 333$ (otherwise $a + a + a > 1000$)
- For each $a$, we can solve for $b$ using the constraint equations

Given:
- $a + b + c = 1000$ → $c = 1000 - a - b$
- $a^2 + b^2 = c^2$ → $a^2 + b^2 = (1000 - a - b)^2$

## Complexity

- **Time Complexity**: O(n²) for brute force approach, where n is the sum constraint
- **Space Complexity**: O(1)

## Solution

View the complete solution on [GitHub](https://github.com/atyansh/Project-Euler/blob/master/Euler9.java).

## Related Concepts

- Pythagorean theorem
- Number theory
- Algebraic manipulation
- Brute force search optimization
