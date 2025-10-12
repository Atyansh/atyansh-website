---
problemNumber: 38
title: 'Pandigital Multiples'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler38.java'
---

## Problem Statement

Take the number 192 and multiply it by each of 1, 2, and 3:

- 192 × 1 = 192
- 192 × 2 = 384
- 192 × 3 = 576

By concatenating each product we get the 1 to 9 pandigital, 192384576. We will call 192384576 the concatenated product of 192 and (1,2,3).

The same can be achieved by starting with 9 and multiplying by 1, 2, 3, 4, and 5, giving the pandigital, 918273645, which is the concatenated product of 9 and (1,2,3,4,5).

What is the largest 1 to 9 pandigital 9-digit number that can be formed as the concatenated product of an integer with (1,2,...,n) where n > 1?

## Approach

The solution involves:
1. Testing different base numbers systematically
2. For each base, multiplying by 1, 2, 3, etc., and concatenating results
3. Stopping when the concatenation reaches or exceeds 9 digits
4. Checking if the result is a 1-9 pandigital
5. Tracking the maximum pandigital found
