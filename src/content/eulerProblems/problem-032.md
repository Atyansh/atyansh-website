---
problemNumber: 32
title: 'Pandigital Products'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler32.java'
---

## Problem Statement

We shall say that an n-digit number is pandigital if it makes use of all the digits 1 to n exactly once; for example, the 5-digit number, 15234, is 1 through 5 pandigital.

The product 7254 is unusual, as the identity, 39 × 186 = 7254, containing multiplicand, multiplier, and product is 1 through 9 pandigital.

Find the sum of all products whose multiplicand/multiplier/product identity can be written as a 1 through 9 pandigital.

HINT: Some products can be obtained in more than one way so be sure to only include it once in your sum.

## Approach

The solution involves:
1. Generating combinations of 1-digit and 4-digit numbers, or 2-digit and 3-digit numbers
2. Checking if multiplicand, multiplier, and product together form a 1-9 pandigital
3. Using a Set to store unique products
4. Summing all unique products found
