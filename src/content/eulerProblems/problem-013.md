---
problemNumber: 13
title: 'Large Sum'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler13.java'
---

## Problem Statement

Work out the first ten digits of the sum of the following one-hundred 50-digit numbers.

(A list of 100 fifty-digit numbers is provided in the problem.)

## Approach

To find the first ten digits of the sum:

**Method 1: Using BigInteger**
- Use Java's BigInteger class to handle large numbers
- Parse each 50-digit number as a BigInteger
- Add all of them together
- Convert the result to a string and extract the first 10 digits

**Method 2: Optimization**
- Since we only need the first 10 digits, we can add just the first 11-12 digits of each number
- Add them all up, handling carries properly
- Extract the first 10 digits of the sum

The BigInteger approach is simpler and more straightforward, while the optimization approach is more efficient but requires careful handling of carries and edge cases.
