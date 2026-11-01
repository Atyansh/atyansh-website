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

Brute force over every pair i, j below 10,000, about 10⁸ pairs, immediately skipping any pair whose product falls outside 100 … 10,000. The product has to be 4 digits (the three numbers share 9 digits, and a product has either as many digits as its two factors combined or one fewer), so this filter is looser than it needs to be, but it's a cheap test.

For each surviving pair, I peel digits off the product, `i` and `j` in turn and add them to a `TreeSet`, bailing out as soon as a digit repeats or all three are used up before 9 digits. The pair counts only if all three numbers are fully consumed at exactly 9 digits and 0 never appeared.

```java
if(product == 0 && I == 0 & J == 0 && !digits.contains(0) && products.add(i*j))
  sum += i*j;
```

The second `TreeSet`, `products`, handles the "count each product once" rule: the same product can come from more than one factor pair, and every pair is also visited as both i × j and j × i.

## Notes

Restricting the search to 1-digit × 4-digit and 2-digit × 3-digit factors would cut it from 10⁸ pairs to under 10⁴.
