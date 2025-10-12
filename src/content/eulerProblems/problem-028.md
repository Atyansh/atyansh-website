---
problemNumber: 28
title: 'Number Spiral Diagonals'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler28.java'
---

## Problem Statement

Starting with the number 1 and moving to the right in a clockwise direction a 5 by 5 spiral is formed as follows:

```
21 22 23 24 25
20  7  8  9 10
19  6  1  2 11
18  5  4  3 12
17 16 15 14 13
```

It can be verified that the sum of the numbers on the diagonals is 101.

What is the sum of the numbers on the diagonals in a 1001 by 1001 spiral formed in the same way?

## Approach

The solution involves:
1. Observing the pattern: diagonal values increase by increments of the current ring size
2. Computing the corner values for each square ring analytically
3. Summing all diagonal values without building the entire spiral
4. Using the mathematical pattern: for each ring, the corners follow a predictable sequence
