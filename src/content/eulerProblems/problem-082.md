---
problemNumber: 82
title: 'Path Sum: Three Ways'
difficulty: 20
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler82.java'
---

## Problem Statement

NOTE: This problem is a more challenging version of Problem 81.

The minimal path sum in the 5 by 5 matrix below, by starting in any cell in the left column and finishing in any cell in the right column, and only moving up, down, and right, is indicated in bold red and is equal to 994.

```
131 673 234 103 18
201 96  342 965 150
630 803 746 422 111
537 699 497 121 956
805 732 524 37  331
```

Find the minimal path sum from the left column to the right column in matrix.txt, a 31K text file containing an 80 by 80 matrix.

## Approach

The solution involves:
1. Reading the 80x80 matrix from the file
2. Using dynamic programming with column-by-column processing
3. For each column, computing minimal paths from any cell in the previous column
4. Allowing moves: right, up, and down
5. The answer is the minimum value in the rightmost column
