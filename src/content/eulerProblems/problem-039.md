---
problemNumber: 39
title: 'Integer Right Triangles'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler39.java'
---

## Problem Statement

If p is the perimeter of a right angle triangle with integral length sides, {a,b,c}, there are exactly three solutions for p = 120.

{20,48,52}, {24,45,51}, {30,40,50}

For which value of p ≤ 1000, is the number of solutions maximised?

## Approach

The solution involves:
1. Iterating through all possible perimeters up to 1000
2. For each perimeter p, finding all valid right triangles with sides summing to p
3. Using the Pythagorean theorem: a² + b² = c²
4. Counting solutions for each perimeter
5. Finding the perimeter with the maximum number of solutions
