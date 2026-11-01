---
problemNumber: 11
title: 'Largest Product in a Grid'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler11.java'
---

## The problem

In a given 20×20 grid of two-digit numbers, find the largest product of four numbers in a line: horizontal, vertical or diagonal.

## My solution

The grid is read from `Euler11.txt` with a `Scanner` into an `int[20][20]`. Then there are three separate double loops, one per direction, each with bounds chosen so that four cells always fit:

- horizontal: every row, columns 0–16
- vertical: rows 0–16, every column
- diagonals: rows 0–16 and columns 0–16, computing both the down-right diagonal and the down-left one (`arr[i][j+3] * arr[i+1][j+2] * arr[i+2][j+1] * arr[i+3][j]`) in the same pass

Each product is compared against a running maximum. Only four directions are needed because the other four (left, up, and the two upward diagonals) cover the same sets of four cells. The largest possible product is 99⁴ ≈ 9.6 × 10⁷, so `int` is enough.
