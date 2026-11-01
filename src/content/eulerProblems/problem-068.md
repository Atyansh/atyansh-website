---
problemNumber: 68
title: 'Magic 5-gon Ring'
difficulty: 25
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler68.java'
---

## The problem

Place 1 to 10 on a 5-gon ring (five outer nodes, five inner, five lines of three) so that every line has the same sum. Reading the lines clockwise, starting from the line with the smallest outer node, gives a digit string. Find the largest such string with 16 digits.

## My solution

Brute force over all 10! = 3,628,800 arrangements, using the next-permutation routine from my Problem 24 solution. Since that routine works on a `char[]`, the numbers 1 to 10 are encoded as the characters '0' to '9', with '9' standing for 10. Indices 0–4 hold the inner ring and 5–9 the outer nodes, and the line through outer node i is (i, i−5, i−4), with the last one wrapping to (9, 4, 0).

For each arrangement the code:

1. Skips it unless 10 is an outer node. An inner 10 would sit on two lines and make a 17-digit string, so this is the 16-digit filter.
2. Finds the smallest outer node and walks the lines clockwise from there, wrapping from index 9 back to 5, and drops the arrangement as soon as a line sum differs from the first. Sums are compared on the encoded characters, which is fine because every line is shifted by the same amount.
3. Concatenates the encoded lines, parses the result as a `long`, and keeps the maximum.

At the end, `parse` decodes the winning string by adding 1 to each digit and turning '9' into "10".

```java
for(int i = 0; i < arr.length; i++)
  str += (arr[i] == '9') ? "10" : ( (char) (arr[i] + 1));
```

## Notes

Taking the maximum over the encoded strings isn't in general the same as taking it over the decoded ones, because 10 is encoded as a single high digit. For the valid rings here, both orderings pick the same ring.
