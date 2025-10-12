---
problemNumber: 37
title: 'Truncatable Primes'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler37.py'
---

## Problem Statement

The number 3797 has an interesting property. Being prime itself, it is possible to continuously remove digits from left to right, and remain prime at each stage: 3797, 797, 97, and 7. Similarly we can work from right to left: 3797, 379, 37, and 3.

Find the sum of the only eleven primes that are both truncatable from left to right and right to left.

NOTE: 2, 3, 5, and 7 are not considered to be truncatable primes.

## Approach

The solution involves:
1. Generating prime numbers systematically
2. For each prime (excluding single-digit primes), checking all left truncations
3. Checking all right truncations
4. Verifying that all truncations are prime
5. Summing the eleven primes that satisfy both conditions
