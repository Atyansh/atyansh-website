---
problemNumber: 49
title: 'Prime Permutations'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler49.java'
---

## Problem Statement

The arithmetic sequence, 1487, 4817, 8147, in which each of the terms increases by 3330, is unusual in two ways: (i) each of the three terms are prime, and, (ii) each of the 4-digit numbers are permutations of one another.

There are no arithmetic sequences made up of three 1-, 2-, or 3-digit primes, exhibiting this property, but there is one other 4-digit increasing sequence.

What 12-digit number do you form by concatenating the three terms in this sequence?

## Approach

The solution involves:
1. Generating all 4-digit primes
2. Grouping primes that are permutations of each other
3. For each group, checking for arithmetic sequences
4. Finding sequences where all three terms are prime and form equal differences
5. Concatenating the three terms of the non-1487 sequence
