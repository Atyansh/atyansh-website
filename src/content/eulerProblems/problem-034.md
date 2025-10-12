---
problemNumber: 34
title: 'Digit Factorials'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler34.java'
---

## Problem Statement

145 is a curious number, as 1! + 4! + 5! = 1 + 24 + 120 = 145.

Find the sum of all numbers which are equal to the sum of the factorial of their digits.

Note: As 1! = 1 and 2! = 2 are not sums they are not included.

## Approach

The solution involves:
1. Determining an upper bound for the search (7 × 9! = 2,540,160)
2. For each number, computing the sum of factorials of its digits
3. Checking if the sum equals the original number
4. Summing all such numbers (excluding 1 and 2)
