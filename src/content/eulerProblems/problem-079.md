---
problemNumber: 79
title: 'Passcode Derivation'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler79.java'
---

## Problem Statement

A common security method used for online banking is to ask the user for three random characters from a passcode. For example, if the passcode was 531278, they may ask for the 2nd, 3rd, and 5th characters; the expected reply would be: 317.

The text file, keylog.txt, contains fifty successful login attempts.

Given that the three characters are always asked for in order, analyse the file so as to determine the shortest possible secret passcode of unknown length.

## Approach

The solution involves:
1. Reading all the login attempts from the file
2. Building a directed graph where an edge from A to B means A comes before B
3. Using topological sorting to find the order of digits
4. Constructing the shortest passcode that satisfies all ordering constraints
5. The passcode uses only the digits that appear in the attempts
