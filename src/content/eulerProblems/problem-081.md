---
problemNumber: 81
title: 'Path Sum: Two Ways'
difficulty: 10
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler81.java'
---

## Problem Statement

In the 5 by 5 matrix below, the minimal path sum from the top left to the bottom right, by only moving to the right and down, is indicated in bold red and is equal to 2427.

```
131 673 234 103 18
201 96  342 965 150
630 803 746 422 111
537 699 497 121 956
805 732 524 37  331
```

Find the minimal path sum from the top left to the bottom right by only moving right and down in matrix.txt, a 31K text file containing an 80 by 80 matrix.

## Approach

The solution involves:
1. Reading the 80x80 matrix from the file
2. Using dynamic programming to compute minimal path sums
3. For each cell, the minimal path is min(path from above, path from left) + current value
4. Building the solution bottom-up from top-left to bottom-right
5. The answer is in the bottom-right cell
