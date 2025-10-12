---
problemNumber: 8
title: 'Largest Product in a Series'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler8.java'
---

## Problem Statement

The four adjacent digits in the 1000-digit number that have the greatest product are 9 × 9 × 8 × 9 = 5832.

Find the thirteen adjacent digits in the 1000-digit number that have the greatest product. What is the value of this product?

(The 1000-digit number is provided in the problem.)

## Approach

To find the maximum product of thirteen adjacent digits:

1. Store the 1000-digit number as a string
2. Use a sliding window of size 13
3. For each window position, calculate the product of the 13 digits
4. Keep track of the maximum product found
5. Return the maximum

Optimization tips:
- If any digit in the window is 0, the product is 0, so skip to the position after that 0
- Convert characters to integers for multiplication
- Be careful with integer overflow; use long data type

The time complexity is O(n) where n is the length of the number, since we scan through it once with a sliding window.
