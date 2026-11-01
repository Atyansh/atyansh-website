---
problemNumber: 57
title: 'Square Root Convergents'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler57.java'
---

## The problem

Expanding the continued fraction for √2 one level at a time gives 3/2, 7/5, 17/12, 41/29, and so on. In the first thousand expansions, count how many have a numerator with more digits than the denominator.

## My solution

Only the fractional part needs tracking. If an expansion is 1 + n/d, the next is 1 + 1/(2 + n/d) = 1 + d/(2d + n). So the code keeps n/d, starting at 1/2, and on each step checks whether the full numerator n + d has more digits than d, then moves (n, d) to (d, 2d + n):

```java
if(num.add(den).toString().length() > den.toString().length())
  count++;

temp = num.add(den.add(den));
num = den;
den = temp;
```

It needs `BigInteger` because both terms grow by a factor of about 1 + √2 per step, reaching around 380 digits by the thousandth expansion. The loop is linear in the number of expansions.
