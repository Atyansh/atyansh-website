---
problemNumber: 32
title: 'Pandigital Products'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler32.java'
---

## The problem

Find all products whose multiplication identity (multiplicand × multiplier = product) uses each of the digits 1–9 exactly once, and add them up, counting each product only once.

## My solution

Brute force over every pair i, j below 10,000, immediately skipping any pair whose product falls outside 100 … 10,000.

For each surviving pair, I peel digits off the product, `i` and `j` in turn and add them to a `TreeSet`, bailing out as soon as a digit repeats or all three are used up before 9 digits. The pair counts only if all three numbers are fully consumed at exactly 9 digits and 0 never appeared.

```java
if(product == 0 && I == 0 & J == 0 && !digits.contains(0) && products.add(i*j))
  sum += i*j;
```

The second `TreeSet`, `products`, handles the "count each product once" rule: the same product can come from more than one factor pair, and every pair is also visited as both i × j and j × i.

## Notes

The product always has 4 digits. The three numbers share 9 digits, and a product has either as many digits as its two factors combined or one fewer, which only works out to 9 in total with a 4-digit product. So every identity is either 1 digit × 4 digits or 2 digits × 3 digits.
