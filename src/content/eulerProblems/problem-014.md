---
problemNumber: 14
title: 'Longest Collatz Sequence'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler14.java'
---

## Problem Statement

The following iterative sequence is defined for the set of positive integers:

- n → n/2 (n is even)
- n → 3n + 1 (n is odd)

Using the rule above and starting with 13, we generate the following sequence:
13 → 40 → 20 → 10 → 5 → 16 → 8 → 4 → 2 → 1

This sequence has 10 terms. Although it has not been proved yet (Collatz conjecture), it is thought that all starting numbers finish at 1.

Which starting number, under one million, produces the longest chain?

## Approach

To find the starting number that produces the longest Collatz sequence:

1. Iterate through all numbers from 1 to 999,999
2. For each number, calculate the length of its Collatz sequence
3. Keep track of the number that produces the longest sequence

Optimizations:
- Use memoization to cache the sequence lengths for numbers we've already computed
- When calculating a sequence, if we reach a number we've already processed, we can add its cached length
- Since numbers can grow large during the sequence, use long data type
- Only store results for numbers under 1 million to save memory

This dynamic programming approach significantly speeds up the calculation by avoiding redundant computations.
