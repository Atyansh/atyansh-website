---
problemNumber: 40
title: "Champernowne's Constant"
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler40.java'
---

## Problem Statement

An irrational decimal fraction is created by concatenating the positive integers:

0.123456789101112131415161718192021...

It can be seen that the 12th digit of the fractional part is 1.

If d(n) represents the nth digit of the fractional part, find the value of the following expression:

d(1) × d(10) × d(100) × d(1000) × d(10000) × d(100000) × d(1000000)

## Approach

The solution involves:
1. Building the Champernowne constant string up to 1,000,000 digits
2. Extracting the digits at positions 1, 10, 100, 1000, 10000, 100000, and 1000000
3. Computing the product of these digits
4. Alternatively, calculating the digit at each position mathematically without building the entire string
