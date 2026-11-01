---
problemNumber: 45
title: 'Triangular, Pentagonal, and Hexagonal'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler45.java'
---

## The problem

40755 is a triangle number, a pentagonal number and a hexagonal number all at once. Find the next number with all three properties.

## My solution

I precompute a million terms of each sequence: triangle numbers into an array, pentagonal and hexagonal numbers into two `TreeSet<Long>`s. Everything is computed in `long` arithmetic, since the millionth pentagonal and hexagonal numbers are around 1.5 × 10¹² and 2 × 10¹². Then I scan the triangle numbers starting at index 285 (that's T₂₈₆, the one after T₂₈₅ = 40755) and print the first that appears in both sets.

```java
for(int i = 285; i < size; i++) {
  if(pent.contains(triangle[i]) && hex.contains(triangle[i])) {
    System.out.println(triangle[i]);
    break;
  }
}
```

A million terms gives plenty of room: the match turns up well within the first million triangle numbers, and those are all much smaller than the largest entries in the two sets.

## Notes

Every hexagonal number is also triangular (Hₙ = T₂ₙ₋₁), so in practice the search is for numbers that are both pentagonal and hexagonal.
