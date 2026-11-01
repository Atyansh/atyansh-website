---
problemNumber: 16
title: 'Power Digit Sum'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler16.java'
---

## The problem

Find the sum of the decimal digits of 2¹⁰⁰⁰.

## My solution

2¹⁰⁰⁰ has 302 digits, far beyond any primitive type, so I let `BigInteger` compute it, convert it to a string, and add up the characters:

```java
BigInteger b = new BigInteger("2");
b = b.pow(1000);

String s = b.toString();
for(int i = 0; i < length; i++)
  sum += (s.charAt(i) - 48);
```

Subtracting 48 (the code for '0') turns each digit character into its value. The work is all in `BigInteger.pow` and `toString`, both of which are instant at this size.
