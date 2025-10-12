---
problemNumber: 4
title: 'Largest Palindrome Product'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler4.java'
---

## Problem Statement

A palindromic number reads the same both ways. The largest palindrome made from the product of two 2-digit numbers is 9009 = 91 × 99.

Find the largest palindrome made from the product of two 3-digit numbers.

## Approach

To solve this problem efficiently:
1. Generate products of all pairs of 3-digit numbers (100 to 999)
2. Start from the largest products by iterating in descending order
3. For each product, check if it is a palindrome
4. Return the first (largest) palindrome found

A number is a palindrome if its string representation reads the same forwards and backwards. We can check this by comparing the number with its reverse.

Since we're looking for the largest palindrome, starting from 999 × 999 and working downwards will find the answer more quickly.
