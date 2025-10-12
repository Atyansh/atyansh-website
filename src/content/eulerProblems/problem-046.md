---
problemNumber: 46
title: "Goldbach's Other Conjecture"
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler46.java'
---

## Problem Statement

It was proposed by Christian Goldbach that every odd composite number can be written as the sum of a prime and twice a square.

- 9 = 7 + 2 × 1²
- 15 = 7 + 2 × 2²
- 21 = 3 + 2 × 3²
- 25 = 7 + 2 × 3²
- 27 = 19 + 2 × 2²
- 33 = 31 + 2 × 1²

It turns out that the conjecture was false.

What is the smallest odd composite that cannot be written as the sum of a prime and twice a square?

## Approach

The solution involves:
1. Generating odd composite numbers
2. For each composite, testing if it can be expressed as prime + 2 × square
3. Using a prime sieve for efficient prime checking
4. Finding the first composite that cannot be expressed in this form
