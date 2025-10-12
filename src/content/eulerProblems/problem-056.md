---
problemNumber: 56
title: 'Powerful Digit Sum'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler56.java'
---

## Problem Statement

A googol (10^100) is a massive number: one followed by one-hundred zeros; 100^100 is almost unimaginably large: one followed by two-hundred zeros. Despite their size, the sum of the digits in each number is only 1.

Considering natural numbers of the form, a^b, where a, b < 100, what is the maximum digital sum?

## Approach

The solution involves:
1. Iterating through all combinations where a < 100 and b < 100
2. Computing a^b using BigInteger to handle large numbers
3. Converting each result to a string and summing its digits
4. Tracking the maximum digit sum found
