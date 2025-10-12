---
problemNumber: 57
title: 'Square Root Convergents'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler57.java'
---

## Problem Statement

It is possible to show that the square root of two can be expressed as an infinite continued fraction.

√2 = 1 + 1/(2 + 1/(2 + 1/(2 + ... ))) = 1.414213...

By expanding this for the first four iterations, we get:

1 + 1/2 = 3/2 = 1.5
1 + 1/(2 + 1/2) = 7/5 = 1.4
1 + 1/(2 + 1/(2 + 1/2)) = 17/12 = 1.41666...
1 + 1/(2 + 1/(2 + 1/(2 + 1/2))) = 41/29 = 1.41379...

The next three expansions are 99/70, 239/169, and 577/408, but the eighth expansion, 1393/985, is the first example where the number of digits in the numerator exceeds the number of digits in the denominator.

In the first one-thousand expansions, how many fractions contain a numerator with more digits than the denominator?

## Approach

The solution involves:
1. Generating the continued fraction expansion iteratively
2. Using the recurrence relation for numerators and denominators
3. Using BigInteger to handle large numbers
4. Comparing digit counts for numerator and denominator
5. Counting expansions where numerator has more digits
