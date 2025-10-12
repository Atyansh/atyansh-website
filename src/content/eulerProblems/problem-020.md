---
problemNumber: 20
title: 'Factorial Digit Sum'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler20.java'
---

## Problem Statement

n! means n × (n - 1) × ... × 3 × 2 × 1

For example, 10! = 10 × 9 × ... × 3 × 2 × 1 = 3,628,800, and the sum of the digits in the number 10! is 3 + 6 + 2 + 8 + 8 + 0 + 0 = 27.

Find the sum of the digits in the number 100!

## Approach

Since 100! is an extremely large number (158 digits), we need to use arbitrary-precision arithmetic.

**Using BigInteger:**
1. Calculate 100! using BigInteger
2. Convert the result to a string
3. Iterate through each character (digit)
4. Sum all the digits

Implementation:
```java
BigInteger factorial = BigInteger.ONE;
for (int i = 2; i <= 100; i++) {
    factorial = factorial.multiply(BigInteger.valueOf(i));
}
String digits = factorial.toString();
int sum = 0;
for (char c : digits.toCharArray()) {
    sum += c - '0';
}
```

This approach is straightforward and leverages Java's built-in support for large numbers. The alternative would be implementing factorial multiplication manually with an array, but BigInteger handles this efficiently.
