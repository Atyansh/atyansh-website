---
problemNumber: 67
title: 'Maximum Path Sum II'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler67.java'
---

## Problem Statement

By starting at the top of the triangle below and moving to adjacent numbers on the row below, the maximum total from top to bottom is 23.

```
   3
  7 4
 2 4 6
8 5 9 3
```

That is, 3 + 7 + 4 + 9 = 23.

Find the maximum total from top to bottom in triangle.txt, a 15K text file containing a triangle with one-hundred rows.

NOTE: This is a much more difficult version of Problem 18. It is not possible to try every route to solve this problem, as there are 2⁹⁹ altogether! If you could check one trillion (10¹²) routes every second it would take over twenty billion years to check them all. There is an efficient algorithm to solve it. ;o)

## Approach

The solution involves:
1. Reading the triangle from the file
2. Using dynamic programming to compute maximum path sums bottom-up
3. Starting from the second-to-last row, adding the maximum of the two adjacent values below
4. Working up to the top to find the maximum total path sum
5. Same algorithm as Problem 18, but with a larger triangle
