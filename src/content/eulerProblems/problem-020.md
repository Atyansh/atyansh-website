---
problemNumber: 20
title: 'Factorial Digit Sum'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler20.java'
---

## The problem

Find the sum of the decimal digits of 100!.

## My solution

100! has 158 digits, so it needs arbitrary-precision arithmetic. There are two short versions.

**Java (`Euler20.java`)** multiplies a `BigInteger` accumulator by 100, 99, …, 1, decrementing the multiplier by adding `BigInteger("-1")` each time, then sums the characters of the decimal string:

```java
for(int i = 0; i < 100; i++) {
  c = c.multiply(b);
  b = b.add(new BigInteger("-1"));
}
```

**Python (`Euler20.py`, Python 2)** uses native big integers and a recursive factorial with base case `n <= 2: return n`, then sums `int(a)` over the digits of `str(n)`. (That base case would make `fact(0)` return 0, but it is only ever called with 100.)

Both do about a hundred big-number multiplications, which is instant.
