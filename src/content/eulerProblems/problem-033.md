---
problemNumber: 33
title: 'Digit Cancelling Fractions'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler33.java'
---

## The problem

Some fractions with two-digit numerator and denominator keep their value when you wrongly "cancel" a digit the two share. Excluding trivial cases with zeros, there are four such fractions below 1; multiply them and give the denominator of the product in lowest terms.

## My solution

The program finds the four fractions; the final multiplication and reduction were done by hand.

It loops over numerators 11–97 and larger denominators up to 98. Denominators ending in 0 are skipped, and a numerator ending in 0 skips its whole row, which removes the trivial cases. Each number is split into tens and units digits, and if some digit of the numerator matches some digit of the denominator, the code cancels it and compares the remaining one-digit fraction with the original. Matches are printed.

```java
if( (((double) I)/J) == (((double) i)/j))
  System.out.println(i+"/"+j);
```

That is only a few thousand pairs, so it runs instantly.

## Notes

Comparing doubles with `==` is safe here: IEEE division is correctly rounded, so two fractions with the same exact value always produce the same double.

The denominator only goes up to 98, which loses nothing: cancelling a 9 from x/99 only preserves the value when x = 99.
