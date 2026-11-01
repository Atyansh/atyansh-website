---
problemNumber: 6
title: 'Sum Square Difference'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler6.java'
---

## The problem

For the numbers 1 to 100, take the square of their sum and subtract the sum of their squares.

## My solution

The code mixes the two approaches. The sum of squares is a plain loop, while the square of the sum uses the closed form (n(n+1)/2)², written as (100·101)²/4:

```java
for(int i = 1; i <= 100; i++)
  a += i*i;

b = (100*101)*(100*101)/4;
c = b-a;
```

Everything fits comfortably in an `int` (10100² is about 10⁸), so overflow isn't a concern.

## Notes

The loop could also be replaced by the formula for the sum of squares, n(n+1)(2n+1)/6, which makes the whole thing O(1).
