---
problemNumber: 56
title: 'Powerful Digit Sum'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler56.java'
---

## The problem

Among all numbers aᵇ with a, b < 100, find the largest digit sum.

## My solution

Brute force over every pair using `BigInteger.pow`, then summing the characters of the decimal string (subtracting 48, the code for '0', from each) and keeping the maximum.

```java
while(b < 100) {
  b++;
  exp = num.pow(b);
  temp = digitSum(exp.toString());
  if(temp > sum)
    sum = temp;
}
```

Each loop increments its counter before using it, so a and b run from 2 to 100. That's about 9,800 powers of up to 200 digits each.
