---
problemNumber: 13
title: 'Large Sum'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler13.java'
---

## The problem

Add up one hundred given 50-digit numbers and report the first ten digits of the total.

## My solution

There are two versions, and both just do exact big-integer addition.

**Java** (`Euler13.java`): a `Scanner` reads `Euler13.txt` token by token with `nextBigInteger()` and adds each value into a running `BigInteger`. The program prints the whole sum, and I read the first ten digits off the output rather than having the code trim it.

```java
BigInteger b = new BigInteger("0");
while(scan.hasNext())
  b = b.add(scan.nextBigInteger());
```

**Python** (`Euler13.py`, Python 2): Python ints are arbitrary precision, so no library is needed. The file is read in fixed 50-character chunks, one per number, with a `read(1)` after each chunk to skip the newline.

The sum of a hundred 50-digit numbers has at most 52 digits, so either version finishes instantly.

## Notes

Only the leading digits really matter: summing just the leading 11 or 12 digits of each number gives the right first ten digits as long as the carry from the dropped digits can't change them.
