---
problemNumber: 63
title: 'Powerful Digit Counts'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler63.py'
---

## Problem Statement

The 5-digit number, 16807 = 7⁵, is also a fifth power. Similarly, the 9-digit number, 134217728 = 8⁹, is a ninth power.

How many n-digit positive integers exist which are also an nth power?

## Approach

The solution involves:
1. Recognizing that for n-digit numbers to be nth powers, the base must be less than 10
2. For each base b (1-9), computing b^n for increasing n
3. Checking if the number of digits equals n
4. Stopping when b^n has fewer than n digits (this happens eventually for all bases)
5. Counting all valid combinations
