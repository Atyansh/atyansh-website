---
problemNumber: 35
title: 'Circular Primes'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler35.java'
---

## Problem Statement

The number, 197, is called a circular prime because all rotations of the digits: 197, 971, and 719, are themselves prime.

There are thirteen such primes below 100: 2, 3, 5, 7, 11, 13, 17, 31, 37, 71, 73, 79, and 97.

How many circular primes are there below one million?

## Approach

The solution involves:
1. Generating all prime numbers below one million using Sieve of Eratosthenes
2. For each prime, generating all rotations of its digits
3. Checking if all rotations are also prime
4. Counting all numbers that satisfy the circular prime property
