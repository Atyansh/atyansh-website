---
problemNumber: 206
title: 'Concealed Square'
difficulty: 5
solved: true
solutionLanguage: 'Python'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler206.py'
---

## The problem

Find the positive integer whose square has the digit pattern 1_2_3_4_5_6_7_8_9_0, where each blank is a single unknown digit.

## My solution

Project Euler asks that solutions past problem 100 not be published, so this is only a sketch.

It's a brute-force search in Python 2. The square ends in 0, so the number ends in 0 and only multiples of 10 need checking. The square has 19 digits and starts with 1, so its root lies between about 1.01 × 10⁹ and 1.39 × 10⁹. The loop uses rounder bounds than that, 10⁹ to 1.415 × 10⁹.

For each candidate, I square it and peel off digits from the right two at a time with integer division by 100, checking that the fixed positions read 9, 8, 7, …, 1 and that nothing remains above the leading 1. The first match is printed.

That's tens of millions of squarings in pure Python.
