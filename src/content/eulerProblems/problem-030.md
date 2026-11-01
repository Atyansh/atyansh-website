---
problemNumber: 30
title: 'Digit Fifth Powers'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler30.java'
---

## The problem

Find the sum of all numbers that equal the sum of the fifth powers of their own digits (1 doesn't count, since it isn't a sum).

## My solution

Brute force over 101 … 999,999. For each number I peel off digits with `% 10`, add `Math.pow(digit, 5)`, and compare the total to the original.

A comment in the code justifies stopping at a million informally: past that point the digit sum "simply cannot catch up". The precise version: a number with d ≥ 7 digits is at least 10ᵈ⁻¹, but its digit fifth-power sum is at most d × 9⁵ (413,343 for d = 7), which is far smaller. So the bound is safe. It's also loose: no 6-digit number can exceed 6 × 9⁵ = 354,294, so roughly two thirds of the loop is wasted, though a million iterations hardly matter.

Starting at 101 skips 1, which the problem excludes, along with all two-digit numbers. I checked separately that nothing below 101 qualifies, so that's safe too.
