---
problemNumber: 7
title: '10001st Prime'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler7.java'
---

## Problem Statement

By listing the first six prime numbers: 2, 3, 5, 7, 11, and 13, we can see that the 6th prime is 13.

What is the 10,001st prime number?

## Approach

To find the 10,001st prime number, we need to generate primes sequentially:

1. Start with a counter and check each number for primality
2. A number is prime if it's not divisible by any prime smaller than its square root
3. Keep track of how many primes we've found
4. Return the number when we reach the 10,001st prime

For efficiency:
- Skip even numbers (except 2)
- Only check divisibility by previously found primes up to the square root
- Store found primes in a list to speed up future primality checks

Alternative approaches include using the Sieve of Eratosthenes with an estimated upper bound for the 10,001st prime.
