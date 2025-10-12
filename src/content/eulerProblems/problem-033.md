---
problemNumber: 33
title: 'Digit Cancelling Fractions'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler33.java'
---

## Problem Statement

The fraction 49/98 is a curious fraction, as an inexperienced mathematician in attempting to simplify it may incorrectly believe that 49/98 = 4/8, which is correct, is obtained by cancelling the 9s.

We shall consider fractions like, 30/50 = 3/5, to be trivial examples.

There are exactly four examples of this type of fraction, less than one in value, and containing two digits in the numerator and denominator.

If the product of these four fractions is given in its lowest common terms, find the value of the denominator.

## Approach

The solution involves:
1. Iterating through all two-digit numerators and denominators where numerator < denominator
2. Checking if cancelling a common digit incorrectly produces the correct simplified fraction
3. Excluding trivial examples (multiples of 10)
4. Computing the product of all four fractions and reducing to lowest terms
