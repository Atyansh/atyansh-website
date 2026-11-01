---
problemNumber: 71
title: 'Ordered Fractions'
difficulty: 10
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler71.java'
---

## The problem

List every reduced proper fraction n/d with d ≤ 1,000,000 in increasing order. Find the numerator of the fraction that sits immediately to the left of 3/7.

## My solution

For a fixed denominator d, the closest fraction at or below 3/7 has numerator ⌊3d/7⌋. So I loop over every denominator from 8 to 1,000,000, take that numerator, and keep the largest value seen among the candidates that are already in lowest terms:

```java
for(int i = 8; i <= 1000000; i++) {
  int j = 3*i/7;

  if(hcf(i,j) == 1) {
    double temp = ((double)j)/i;
    if(temp > difference) {
      difference = temp;
      num = j;
    }
  }
}
```

`hcf` is a plain Euclidean GCD. A few details make this correct without any special cases:

- Starting at d = 8 skips 3/7 itself. For later multiples of 7, ⌊3d/7⌋/d equals 3/7 but isn't reduced, so the GCD check drops it. The fraction just below it for those denominators, (3k−1)/7k, is about 1/d away from 3/7, far worse than what large denominators give, so skipping it costs nothing.
- A candidate that isn't reduced is the same value as a fraction with a smaller denominator, so dropping it loses nothing.
- The candidates near the top differ from each other by around 10⁻¹², well within `double` precision, so comparing them as doubles is safe.

That's one GCD per denominator, about a million in total.

## Notes

There's a neat shortcut via Farey sequences: the fraction n/d immediately left of a/b satisfies ad − bn = 1, so here 3d − 7n = 1: take the largest d ≤ 1,000,000 with 3d ≡ 1 (mod 7) and n = (3d − 1)/7.
