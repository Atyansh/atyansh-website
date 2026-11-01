---
problemNumber: 73
title: 'Counting Fractions in a Range'
difficulty: 15
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler73.java'
---

## The problem

Count the reduced proper fractions with denominator d ≤ 12,000 that lie strictly between 1/3 and 1/2.

## My solution

Brute force. For each denominator, the numerators strictly above d/3 and at most d/2 are ⌊d/3⌋+1 … ⌊d/2⌋. I check each one with a Euclidean GCD and count the coprime pairs:

```java
for(int i = 5; i <= 12000; i++)
  for(int j = i/3+1; j <= i/2; j++)
    if(hcf(i,j) == 1)
      answer++;
```

The endpoints take care of themselves. ⌊d/3⌋+1 never reaches 1/3, and when d is even the numerator d/2 gives 1/2, which fails the GCD test because gcd(d, d/2) = d/2 > 1. The loop starts at 5 because denominators 2 to 4 have nothing strictly between 1/3 and 1/2 (2/5 is the first such fraction).

Each denominator has about d/6 numerators to check, so this is roughly 12,000²/12 ≈ 12 million GCD calls.

## Notes

Going through the Farey sequence with the next-term recurrence would visit only the fractions that are actually counted, and would need no GCDs.
