---
problemNumber: 87
title: 'Prime Power Triples'
difficulty: 20
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler87.java'
---

## Problem Statement

The smallest number expressible as the sum of a prime square, prime cube, and prime fourth power is 28. In fact, there are exactly four numbers below fifty that can be expressed in such a way:

- 28 = 2² + 2³ + 2⁴
- 33 = 3² + 2³ + 2⁴
- 49 = 5² + 2³ + 2⁴
- 47 = 2² + 3³ + 2⁴

How many numbers below fifty million can be expressed as the sum of a prime square, prime cube, and prime fourth power?

## Approach

The solution involves:
1. Generating all primes up to sqrt(50,000,000) using Sieve of Eratosthenes
2. For each combination of three primes (a, b, c), computing a² + b³ + c⁴
3. Checking if the sum is less than 50,000,000
4. Using a Set to store unique sums
5. Counting the total number of unique sums
