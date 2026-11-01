---
problemNumber: 17
title: 'Number Letter Counts'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler17.java'
---

## The problem

Write out every number from 1 to 1000 in British English words ("three hundred and forty-two") and count the letters used, ignoring spaces and hyphens.

## My solution

The program never converts a single number to words. Instead I worked out by hand how many times each of the 30 distinct words appears across all 1000 numbers, and the program just sums letters × occurrences:

```java
words[0]  = new Euler17("one",      3,  9*10+101);
words[1]  = new Euler17("two",      3,  9*10+100);
...
words[9]  = new Euler17("ten",      3,  10);
words[19] = new Euler17("twenty",   6,  100);
words[27] = new Euler17("hundred",  7,  900);
words[28] = new Euler17("thousand", 8,  1);
words[29] = new Euler17("and",      3,  99*9);
```

The counts come from the structure of the numbers:

- **Units (one–nine):** each appears 9 times in every block of 100 (e.g. 1, 21, 31, …, 91 for "one"; the teens use their own words), and there are 10 such blocks: 9·10. As a hundreds digit, each also starts 100 numbers ("two hundred …"): +100. "One" gets one more for "one thousand".
- **Ten to nineteen:** once per block of 100, so 10 each.
- **Twenty–ninety:** ten numbers per block (20–29, …), times 10 blocks: 100 each.
- **Hundred:** every number from 100 to 999: 900.
- **And:** every number from 100 to 999 that isn't an exact hundred: 9 · 99.

The class doubles as its own record type (`word`, `count`, `freq`). The `word` strings aren't needed for the arithmetic; they're there to make the table readable.
