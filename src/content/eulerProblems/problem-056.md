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

Because each loop increments before using its counter, a and b actually run from 2 to 100 inclusive. Skipping 1 is safe (1ᵇ has digit sum 1, and a¹ has at most two digits), and including 100 is harmless (100ᵇ has digit sum 1). That's about 9,800 powers of up to 200 digits each.
