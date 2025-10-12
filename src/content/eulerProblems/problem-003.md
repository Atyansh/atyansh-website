---
problemNumber: 3
title: 'Largest Prime Factor'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler3.java'
---

## Problem Statement

The prime factors of 13195 are 5, 7, 13 and 29.

What is the largest prime factor of the number 600851475143?

## Approach

To find the largest prime factor of a number, we can use trial division starting from the smallest prime factors and working our way up. The key insight is that we only need to check up to the square root of the number, as any factor larger than the square root would have already been found as a complementary factor.

The algorithm:
1. Start by dividing the number by 2 repeatedly to remove all factors of 2
2. Then check odd numbers starting from 3
3. For each factor found, divide it out completely
4. Continue until the number becomes 1
5. The last factor found will be the largest prime factor
