---
problemNumber: 25
title: '1000-digit Fibonacci Number'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler25.py'
---

## Problem Statement

The Fibonacci sequence is defined by the recurrence relation:

F(n) = F(n-1) + F(n-2), where F(1) = 1 and F(2) = 1.

Hence the first 12 terms will be:

- F(1) = 1
- F(2) = 1
- F(3) = 2
- F(4) = 3
- F(5) = 5
- F(6) = 8
- F(7) = 13
- F(8) = 21
- F(9) = 34
- F(10) = 55
- F(11) = 89
- F(12) = 144

The 12th term, F(12), is the first term to contain three digits.

What is the index of the first term in the Fibonacci sequence to contain 1000 digits?

## Approach

The solution involves:
1. Generating Fibonacci numbers sequentially
2. Checking the number of digits in each term
3. Using BigInteger in Java to handle large numbers
4. Stopping when we find the first term with 1000 digits
