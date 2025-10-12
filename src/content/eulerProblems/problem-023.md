---
problemNumber: 23
title: 'Non-Abundant Sums'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler23.java'
---

## Problem Statement

A perfect number is a number for which the sum of its proper divisors is exactly equal to the number. For example, the sum of the proper divisors of 28 would be 1 + 2 + 4 + 7 + 14 = 28, which means that 28 is a perfect number.

A number n is called deficient if the sum of its proper divisors is less than n and it is called abundant if this sum exceeds n.

As 12 is the smallest abundant number, 1 + 2 + 3 + 4 + 6 = 16, the smallest number that can be written as the sum of two abundant numbers is 24. By mathematical analysis, it can be shown that all integers greater than 28123 can be written as the sum of two abundant numbers.

Find the sum of all the positive integers which cannot be written as the sum of two abundant numbers.

## Approach

The solution involves:
1. Finding all abundant numbers up to 28123
2. Marking all numbers that can be expressed as the sum of two abundant numbers
3. Summing all positive integers that cannot be expressed as such sums
