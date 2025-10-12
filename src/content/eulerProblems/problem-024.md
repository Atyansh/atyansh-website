---
problemNumber: 24
title: 'Lexicographic Permutations'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler24.java'
---

## Problem Statement

A permutation is an ordered arrangement of objects. For example, 3124 is one possible permutation of the digits 1, 2, 3 and 4. If all of the permutations are listed numerically or alphabetically, we call it lexicographic order. The lexicographic permutations of 0, 1 and 2 are:

012   021   102   120   201   210

What is the millionth lexicographic permutation of the digits 0, 1, 2, 3, 4, 5, 6, 7, 8 and 9?

## Approach

The solution can be computed efficiently using:
1. Factorial number system to directly compute the nth permutation
2. Or generating permutations in lexicographic order until reaching the millionth one
3. The key insight is that permutations can be grouped by their leading digit
