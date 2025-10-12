---
problemNumber: 22
title: 'Names Scores'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler22.java'
---

## Problem Statement

Using a text file containing over five-thousand first names, begin by sorting it into alphabetical order. Then working out the alphabetical value for each name, multiply this value by its alphabetical position in the list to obtain a name score.

For example, when the list is sorted into alphabetical order, COLIN, which is worth 3 + 15 + 12 + 9 + 14 = 53, is the 938th name in the list. So, COLIN would obtain a score of 938 × 53 = 49714.

What is the total of all the name scores in the file?

## Approach

The solution involves:
1. Reading and parsing the names from the input file
2. Sorting the names alphabetically
3. Calculating each name's alphabetical value (sum of letter positions)
4. Multiplying each name's value by its position in the sorted list
5. Summing all name scores
