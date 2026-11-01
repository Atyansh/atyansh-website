---
problemNumber: 42
title: 'Coded Triangle Numbers'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler42.java'
---

## The problem

Turn each word in a supplied list of about 1,800 English words into a number by adding up its letters' alphabet positions (A = 1, …, Z = 26), and count how many of those numbers are triangle numbers.

## My solution

The input file ([`Euler42.txt`](https://github.com/atyansh/Project-Euler/blob/master/Euler42.txt)) is a single line of quoted, comma-separated words, so I read the line with a `Scanner`, strip the quotes and split on commas. A word's value is the sum of `ch - 64`, since `'A'` is 65.

To test whether a value v is triangular, I invert tₙ = n(n + 1)/2 instead of generating a list of triangle numbers. With t = ⌊√(2v)⌋, v is triangular exactly when t(t + 1)/2 = v:

```java
triangle = (int) Math.sqrt(value*2);

if(((triangle) * (triangle + 1))/2.0 == value)
  count++;
```

This works because if v = t(t + 1)/2, then 2v = t² + t lies between t² and (t + 1)², so the floor of its square root is exactly t.
