---
problemNumber: 68
title: 'Magic 5-gon Ring'
difficulty: 25
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler68.java'
---

## Problem Statement

Consider the following "magic" 3-gon ring, filled with the numbers 1 to 6, and each line adding to nine.

Working clockwise, and starting from the group of three with the numerically lowest external node (4,3,2 in this example), each solution can be described uniquely. For example, the above solution can be described by the set: 4,3,2; 6,2,1; 5,1,3.

It is possible to complete the ring with four different totals: 9, 10, 11, and 12. There are eight solutions in total.

By concatenating each group it is possible to form 9-digit strings; the maximum string for a 3-gon ring is 432621513.

Using the numbers 1 to 10, and depending on arrangements, it is possible to form 16-digit and 17-digit strings. What is the maximum 16-digit string for a "magic" 5-gon ring?

## Approach

The solution involves:
1. Placing numbers 1-10 in the 5-gon ring structure
2. Ensuring all lines sum to the same total
3. Starting from the lowest external node
4. Generating all valid configurations
5. Filtering for 16-digit strings (10 must be external)
6. Finding the maximum 16-digit string
