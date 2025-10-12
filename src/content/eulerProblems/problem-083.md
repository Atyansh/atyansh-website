---
problemNumber: 83
title: 'Path Sum: Four Ways'
difficulty: 25
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler83.java'
---

## Problem Statement

NOTE: This problem is a significantly more challenging version of Problem 81.

In the 5 by 5 matrix below, the minimal path sum from the top left to the bottom right, by moving left, right, up, and down, is indicated in bold red and is equal to 2297.

```
131 673 234 103 18
201 96  342 965 150
630 803 746 422 111
537 699 497 121 956
805 732 524 37  331
```

Find the minimal path sum from the top left to the bottom right by moving left, right, up, and down in matrix.txt, a 31K text file containing an 80 by 80 matrix.

## Approach

The solution involves:
1. Reading the 80x80 matrix from the file
2. Using Dijkstra's algorithm to find the shortest path
3. Treating each cell as a node in a graph
4. Edges connect adjacent cells (up, down, left, right)
5. Finding the shortest path from top-left to bottom-right
