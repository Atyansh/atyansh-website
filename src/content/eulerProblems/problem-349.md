---
problemNumber: 349
title: "Langton's Ant"
difficulty: 30
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler349.java'
---

## Problem Statement

An ant moves on a regular grid of squares that are coloured either black or white. The ant is always oriented in one of the cardinal directions (left, right, up or down) and moves from square to adjacent square according to the following rules:

- if it is on a black square, it flips the color of the square to white, rotates 90 degrees counterclockwise and moves forward one square.
- if it is on a white square, it flips the color of the square to black, rotates 90 degrees clockwise and moves forward one square.

Starting with a grid that is entirely white, how many squares are black after 10¹⁸ moves of the ant?

## Approach

The solution involves:
1. Simulating Langton's Ant until a pattern emerges
2. Recognizing that after initial chaotic behavior, the ant enters a "highway" pattern
3. The highway repeats every 104 moves with a predictable change in black squares
4. Computing the initial chaotic phase explicitly
5. Using the highway pattern to extrapolate to 10¹⁸ moves without full simulation
6. Formula: initial_count + (remaining_moves / highway_period) × highway_increment + adjustment
