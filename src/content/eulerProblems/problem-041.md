---
problemNumber: 41
title: 'Pandigital Prime'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler41.java'
---

## Problem Statement

We shall say that an n-digit number is pandigital if it makes use of all the digits 1 to n exactly once. For example, 2143 is a 4-digit pandigital and is also prime.

What is the largest n-digit pandigital prime that exists?

## Approach

The solution involves:
1. Recognizing that 9-digit and 8-digit pandigitals are divisible by 3 (sum of digits)
2. Generating all 7-digit pandigitals in descending order
3. Checking each for primality
4. Returning the first (largest) prime found
