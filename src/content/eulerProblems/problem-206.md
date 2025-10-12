---
problemNumber: 206
title: 'Concealed Square'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler206.py'
---

## Problem Statement

Find the unique positive integer whose square has the form 1_2_3_4_5_6_7_8_9_0, where each _ is a single digit.

## Approach

The solution involves:
1. Recognizing that the square ends in 0, so the number must end in 0
2. The pattern is: 1?2?3?4?5?6?7?8?9?0 where ? represents unknown digits
3. The number must be between sqrt(10203040506070809) and sqrt(19293949596979899)
4. Iterating through candidates (multiples of 10) and checking if their square matches the pattern
5. Using modulo 10 operations to extract specific digit positions
6. The number ends in either 30 or 70 based on the 9 before the final 0
