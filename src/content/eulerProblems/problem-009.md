---
problemNumber: 9
title: 'Special Pythagorean Triplet'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler9.java'
---

## The problem

There is exactly one Pythagorean triple (a² + b² = c²) with a + b + c = 1000. Find the product a·b·c.

## My solution

Brute force over two variables. Since the sum is fixed, choosing `a` and `b` determines `c = 1000 - a - b`, so I only loop over `a` and `b` and test whether the triple is Pythagorean:

```java
outer:while(a != 1000) {
  int b = 1;
  while (b != 1000-a) {
    int c = 1000-a-b;
    if( (c*c) == ((a*a)+(b*b))) {
      System.out.println(a*b*c);
      break outer;
    }
    b++;
  }
  a++;
}
```

The labeled `break outer` stops both loops as soon as the triple is found. The bounds don't enforce a < b < c, but that doesn't matter because only one triple exists and the product is the same in any order. The worst case is about 500,000 checks (O(n²) in the sum); the search finds the triple partway through and stops.
