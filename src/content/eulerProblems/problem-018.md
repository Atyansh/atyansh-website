---
problemNumber: 18
title: 'Maximum Path Sum I'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler18.java'
---

## Problem Statement

By starting at the top of the triangle and moving to adjacent numbers on the row below, find the maximum total from top to bottom.

Example:
```
   3
  7 4
 2 4 6
8 5 9 3
```

The maximum path is 3 + 7 + 4 + 9 = 23.

(A larger triangle is provided in the problem.)

Note: As there are only 16384 routes in this problem, it is possible to solve by trying every route. However, Problem 67, is the same challenge with a triangle containing one-hundred rows; it cannot be solved by brute force, and requires a clever method!

## Approach

Use dynamic programming to solve this efficiently:

1. Start from the bottom of the triangle and work upwards
2. For each position, calculate the maximum path sum by adding the current value to the maximum of the two possible paths from the row below
3. Continue until reaching the top

Algorithm:
```
For each row from bottom to top (excluding the last row):
  For each element in the row:
    element = element + max(element_below_left, element_below_right)
```

The top element will contain the maximum path sum.

Time complexity: O(n²) where n is the number of rows
Space complexity: O(1) if modifying in place, O(n²) if using extra space

This approach works for any size triangle and is much more efficient than trying all possible paths.
