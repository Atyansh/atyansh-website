---
problemNumber: 16
title: 'Power Digit Sum'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler16.java'
---

## Problem Statement

2^15 = 32768 and the sum of its digits is 3 + 2 + 7 + 6 + 8 = 26.

What is the sum of the digits of the number 2^1000?

## Approach

Since 2^1000 is a very large number that exceeds the capacity of standard integer types, we need to use arbitrary-precision arithmetic.

**Method 1: Using BigInteger**
- Use Java's BigInteger class to calculate 2^1000
- Convert the result to a string
- Iterate through each character (digit)
- Sum all the digits

**Method 2: Manual calculation**
- Implement multiplication by 2 using an array to store digits
- Start with 1 and multiply by 2 a thousand times
- Handle carries during multiplication
- Sum all the digits in the final array

The BigInteger approach is simpler and less error-prone, making it the preferred solution for this problem.
