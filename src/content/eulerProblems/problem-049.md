---
problemNumber: 49
title: 'Prime Permutations'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler49.java'
---

## The problem

1487, 4817 and 8147 are all prime, are digit permutations of one another, and are evenly spaced (each is 3330 more than the last). Exactly one other 4-digit sequence has these properties. Give its three terms concatenated.

## My solution

For each odd 4-digit prime i, the code walks through the rearrangements of its digits in lexicographic order, using the next-permutation routine `Euler24.next` from my Problem 24 solution. Rearrangements of the same digits sort lexicographically in the same order as numerically, and the walk starts from i itself, so every number it visits is larger than i. That makes i the smallest term of any sequence found from it.

Each rearrangement in turn is treated as a candidate second term, which fixes the common difference d = candidate − i. A second pass then continues through the remaining rearrangements and extends the chain whenever one is prime and exactly d above the last accepted term. Any chain of three or more terms is printed as its concatenated digits, so the output contains the example sequence as well as the one the problem asks for.

A 4-digit number has at most 24 rearrangements, so each prime costs at most a few hundred steps.

## Notes

The routine detects the last permutation because `Euler24.next` leaves the array unchanged once it's in descending order. I added that `index == 0` base case to the Problem 24 code specifically for this problem (the commit message says "Helpful for Euler 49"). The file also still contains an unused `uniqueDigits` helper; an earlier version filtered primes with it, and that call was removed in a later "Cleaned up Euler49" commit.
