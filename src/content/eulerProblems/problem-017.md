---
problemNumber: 17
title: 'Number Letter Counts'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler17.java'
---

## Problem Statement

If the numbers 1 to 5 are written out in words: one, two, three, four, five, then there are 3 + 3 + 5 + 4 + 4 = 19 letters used in total.

If all the numbers from 1 to 1000 (one thousand) inclusive were written out in words, how many letters would be used?

Note: Do not count spaces or hyphens. For example, 342 (three hundred and forty-two) contains 23 letters and 115 (one hundred and fifteen) contains 20 letters. The use of "and" when writing out numbers is in compliance with British usage.

## Approach

To count the total letters used:

1. Create mappings for number words:
   - Units: one, two, three, ... nine
   - Teens: ten, eleven, twelve, ... nineteen
   - Tens: twenty, thirty, forty, ... ninety
   - Special: hundred, thousand

2. For each number from 1 to 1000, convert it to words following British conventions:
   - Include "and" between hundreds and tens/units (e.g., "one hundred and twenty")
   - Do not include "and" when there are only hundreds (e.g., "two hundred")

3. Count the letters in each word representation (excluding spaces and hyphens)

4. Sum all the letter counts

The key is to correctly implement the British number naming convention with the proper use of "and".
