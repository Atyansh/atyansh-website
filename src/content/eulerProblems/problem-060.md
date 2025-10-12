---
problemNumber: 60
title: 'Prime Pair Sets'
difficulty: 20
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler60.java'
---

## Problem Statement

The primes 3, 7, 109, and 673, are quite remarkable. By taking any two primes and concatenating them in any order the result will always be prime. For example, taking 7 and 109, both 7109 and 1097 are prime. The sum of these four primes, 792, represents the lowest sum for a set of four primes with this property.

Find the lowest sum for a set of five primes for which any two primes concatenate to produce another prime.

## Approach

The solution involves:
1. Generating prime numbers up to a reasonable limit
2. Testing pairs of primes to see if their concatenations are prime
3. Building sets of primes where all pairs satisfy the concatenation property
4. Using backtracking or systematic search to find sets of size 5
5. Finding the set with the minimum sum
