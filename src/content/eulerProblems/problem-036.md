---
problemNumber: 36
title: 'Double-base Palindromes'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler36.java'
---

## Problem Statement

The decimal number, 585 = 1001001001₂ (binary), is palindromic in both bases.

Find the sum of all numbers, less than one million, which are palindromic in base 10 and base 2.

(Please note that the palindromic number, in either base, may not include leading zeros.)

## Approach

The solution involves:
1. Iterating through all numbers below one million
2. Checking if each number is a palindrome in base 10
3. Converting to binary and checking if it's a palindrome in base 2
4. Ensuring no leading zeros are considered
5. Summing all numbers that are palindromic in both bases
