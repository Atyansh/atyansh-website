---
problemNumber: 14
title: 'Longest Collatz Sequence'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler14.java'
---

## The problem

The Collatz map halves an even number and sends an odd number n to 3n + 1. Find the starting value below one million whose sequence takes the most terms to reach 1.

## My solution

Brute force. For every start from 3 to 999,999, `chain` follows the sequence all the way to 1 and counts the terms, and `main` keeps the start with the longest chain:

```java
public static int chain(long n) {
  int count = 1;
  while(n != 1) {
    if(n % 2 == 0)
      n /= 2;
    else
      n = 3*n + 1;
    count++;
  }
  return count;
}
```

The parameter is a `long` on purpose. Some starting values below one million climb past 2³¹ − 1 before coming back down, so an `int` would overflow and corrupt those chains. Starting at 3 skips 1 and 2, which can't be the answer.

Chains below a million average on the order of a hundred steps, so the total is around 10⁸ simple operations.
