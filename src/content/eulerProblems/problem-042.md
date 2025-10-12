---
problemNumber: 42
title: 'Coded Triangle Numbers'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler42.java'
---

## Problem Statement

The nth term of the sequence of triangle numbers is given by, t(n) = n(n+1)/2; so the first ten triangle numbers are:

1, 3, 6, 10, 15, 21, 28, 36, 45, 55, ...

By converting each letter in a word to a number corresponding to its alphabetical position and adding these values we form a word value. For example, the word value for SKY is 19 + 11 + 25 = 55 = t(10). If the word value is a triangle number then we shall call the word a triangle word.

Using words.txt, a 16K text file containing nearly two-thousand common English words, how many are triangle words?

## Approach

The solution involves:
1. Reading and parsing the words from the file
2. Computing the word value for each word
3. Generating triangle numbers up to a reasonable upper bound
4. Checking if each word value is a triangle number
5. Counting all triangle words
