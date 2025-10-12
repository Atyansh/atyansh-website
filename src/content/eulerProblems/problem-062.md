---
problemNumber: 62
title: 'Cubic Permutations'
difficulty: 15
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler62.java'
---

## Problem Statement

The cube, 41063625 (345³), can be permuted to produce two other cubes: 56623104 (384³) and 66430125 (405³). In fact, 41063625 is the smallest cube which has exactly three permutations of its digits which are also cube.

Find the smallest cube for which exactly five permutations of its digits are cube.

## Approach

The solution involves:
1. Computing cubes sequentially and storing them by their sorted digit signature
2. Grouping cubes that are permutations of each other
3. Finding the first cube that has exactly five permutations (including itself)
4. Using a HashMap with sorted digits as keys to group permutations
