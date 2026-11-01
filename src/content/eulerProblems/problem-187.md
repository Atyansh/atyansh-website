---
problemNumber: 187
title: 'Semiprimes'
difficulty: 25
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler187.java'
---

## The problem

Count the integers below 10⁸ that are the product of exactly two primes, not necessarily distinct.

## My solution

Project Euler asks that solutions past problem 100 not be published, so this is only a sketch.

The program doesn't generate primes itself. It reads them from a precomputed file called `primes` (not in the repo) and loads exactly 3,001,134 of them. That's the number of primes up to 5 × 10⁷, which is as large as either factor can be when the other factor is 2.

Counting each product p·q with p ≤ q exactly once happens in two phases:

1. Among the smallest primes, every pair multiplies to less than the limit. The code finds where that stops being true and counts those pairs and the prime squares with a closed-form formula, with no loop over pairs.
2. For each larger prime, a second index walks down the prime list to the largest partner that keeps the product within the limit. Everything up to that partner counts. The pointer only ever moves down as the larger prime grows, so this phase is a linear two-pointer sweep.

After loading the file, the work is linear in the number of primes.
