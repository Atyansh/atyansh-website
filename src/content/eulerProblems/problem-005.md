---
problemNumber: 5
title: 'Smallest Multiple'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler5.java'
---

## Problem Statement

2520 is the smallest number that can be divided by each of the numbers from 1 to 10 without any remainder.

What is the smallest positive number that is evenly divisible with no remainder by all of the numbers from 1 to 20?

## Approach

This problem asks for the Least Common Multiple (LCM) of all numbers from 1 to 20.

The LCM of two numbers can be calculated using the formula:
```
LCM(a, b) = (a × b) / GCD(a, b)
```

Where GCD is the Greatest Common Divisor, which can be computed using Euclid's algorithm.

To find the LCM of multiple numbers:
1. Start with LCM = 1
2. For each number from 2 to 20, compute: LCM = LCM(LCM, number)
3. The final result is the smallest number divisible by all numbers from 1 to 20

Alternatively, we can use prime factorization: find the highest power of each prime that appears in the range, then multiply them together.
