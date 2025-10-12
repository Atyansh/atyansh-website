---
problemNumber: 31
title: 'Coin Sums'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler31.java'
---

## Problem Statement

In the United Kingdom the currency is made up of pound (£) and pence (p). There are eight coins in general circulation:

1p, 2p, 5p, 10p, 20p, 50p, £1 (100p), and £2 (200p).

It is possible to make £2 in the following way:

1×£1 + 1×50p + 2×20p + 1×5p + 1×2p + 3×1p

How many different ways can £2 be made using any number of coins?

## Approach

The solution involves:
1. Using dynamic programming to count coin combinations
2. Building up the number of ways to make each amount from 1p to 200p
3. For each coin denomination, updating the ways to make each amount
4. Classic coin change problem with a counting variation
