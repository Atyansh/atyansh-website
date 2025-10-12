---
problemNumber: 48
title: 'Self Powers'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler48.py'
---

## Problem Statement

The series, 1¹ + 2² + 3³ + ... + 10¹⁰ = 10405071317.

Find the last ten digits of the series, 1¹ + 2² + 3³ + ... + 1000¹⁰⁰⁰.

## Approach

The solution involves:
1. Computing each self power (n^n) modulo 10^10
2. Using modular arithmetic to keep only the last 10 digits
3. Summing all terms with modular reduction
4. Avoiding overflow by using BigInteger or careful modular exponentiation
