---
problemNumber: 2
title: 'Even Fibonacci Numbers'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler2.java'
---

## The problem

Sum the even-valued Fibonacci numbers that do not exceed four million.

## My solution

A straightforward walk along the sequence. I keep the last three terms in `a`, `b` and `c`, add `c` to the running sum whenever it is even, and stop once it passes four million:

```java
while(c <= 4000000) {
  if(c % 2 == 0)
    sum += c;
  a = b;
  b = c;
  c = a + b;
}
```

Fibonacci numbers grow exponentially, so only a few dozen terms are generated before the loop ends.

## Notes

Every third Fibonacci number is even (the parity pattern is odd, odd, even), and the even terms follow a recurrence of their own: E(n) = 4·E(n−1) + E(n−2).
