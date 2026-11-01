---
problemNumber: 44
title: 'Pentagon Numbers'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler44.java'
---

## The problem

Pentagonal numbers are Pₙ = n(3n − 1)/2. Find the pair Pⱼ, Pₖ whose sum and difference are both pentagonal and whose difference D is as small as possible, and report D.

## My solution

I precompute the first 10,000 pentagonal numbers into both an array and a `TreeSet`, then check every pair i < j. If the difference is already larger than the best D found so far the pair is skipped; otherwise both the sum and the difference are looked up in the set.

```java
sum = arr[i]+arr[j];
diff = arr[j] - arr[i];

if(min < diff)
  continue;

if(pent.contains(sum) && pent.contains(diff))
  min = diff;
```

That's about 5 × 10⁷ pairs, with a logarithmic set lookup for each one that isn't skipped.
