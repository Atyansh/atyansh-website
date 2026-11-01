---
problemNumber: 22
title: 'Names Scores'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler22.java'
---

## The problem

Given a file of about five thousand first names, sort them alphabetically. Each name scores its letter values (A = 1, …, Z = 26) summed, times its 1-based position in the sorted list. Find the total of all the scores.

## My solution

The input file (`Euler22.txt`) is a single line of quoted, comma-separated names. I read that one line, strip the quotes with `replaceAll("\"", "")`, split on commas, and sort with `Arrays.sort`. Every name is uppercase A–Z, so Java's default string ordering is alphabetical order.

```java
Arrays.sort(names);
for(int i = 0; i < names.length; i++)
  sum += (i+1) * getValue(names[i]);
```

`getValue` sums `charAt(i) - 64` over the name, since 'A' is 65 in ASCII. The running total is a `long`. The sort dominates at O(n log n) for 5,163 names, so this runs instantly.
