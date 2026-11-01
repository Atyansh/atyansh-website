---
problemNumber: 61
title: 'Cyclical Figurate Numbers'
difficulty: 20
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler61.java'
---

## The problem

Find the only ordered cycle of six 4-digit numbers in which the last two digits of each number are the first two of the next (wrapping around), and the six are one each of triangular, square, pentagonal, hexagonal, heptagonal and octagonal. Report their sum.

## My solution

First a `HashSet` of 4-digit numbers is built for each of the six polygonal formulas. One loop over n fills all six; it runs until the triangular numbers, the slowest-growing of the six, pass 9,999, so every set is complete.

Then the code tries orderings of the six types around the cycle, generating them with the next-permutation routine from my Problem 24 solution. For each ordering, `check` runs six nested loops, one per type, and only goes deeper when the next number's first two digits (`x / 100`) match the previous number's last two (`x % 100`). The innermost loop also checks that the sixth number links back to the first. The first full cycle found has its sum printed.

```java
for(int c : polygons[indices[2]-48]) {
  if(c / 100 != b % 100)
    continue;

  for(int d : polygons[indices[3]-48]) {
    if(d / 100 != c % 100)
      continue;
```

The prefix check prunes heavily, since each set has only around one number per two-digit prefix on average.

## Notes

The ordering loop calls `next` before its first check, so the identity ordering 0-1-2-3-4-5 is never tried. That's harmless: a cycle has no fixed starting point, and its rotation 1-2-3-4-5-0 is tried. For the same reason, fixing the first type would cut the 720 orderings to 120. The code also doesn't check that the six numbers are distinct (every hexagonal number is also triangular), but the only cycle in this data uses six different numbers.
