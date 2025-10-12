---
problemNumber: 52
title: 'Permuted Multiples'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler52.java'
---

## Problem Statement

It can be seen that the number, 125874, and its double, 251748, contain exactly the same digits, but in a different order.

Find the smallest positive integer, x, such that 2x, 3x, 4x, 5x, and 6x, contain the same digits.

## Approach

The solution involves:
1. Iterating through positive integers starting from 1
2. For each number, computing its multiples 2x, 3x, 4x, 5x, and 6x
3. Checking if all six numbers contain the same digits
4. Sorting digits or using digit frequency to compare
5. Returning the first number that satisfies the property
