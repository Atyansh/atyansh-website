---
problemNumber: 50
title: 'Consecutive Prime Sum'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler50.java'
---

## Problem Statement

The prime 41, can be written as the sum of six consecutive primes:

41 = 2 + 3 + 5 + 7 + 11 + 13

This is the longest sum of consecutive primes that adds to a prime below one-hundred.

The longest sum of consecutive primes below one-thousand that adds to a prime, contains 21 terms, and is equal to 953.

Which prime, below one-million, can be written as the sum of the most consecutive primes?

## Approach

The solution involves:
1. Generating all primes below one million using Sieve of Eratosthenes
2. Computing cumulative sums of consecutive primes
3. For each starting position, checking consecutive sums
4. Verifying if the sum is prime and below one million
5. Tracking the longest sequence that produces a prime sum
