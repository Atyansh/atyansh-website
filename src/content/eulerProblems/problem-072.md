---
problemNumber: 72
title: 'Counting Fractions'
difficulty: 20
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler72.java'
---

## The problem

Count the reduced proper fractions n/d (n < d, gcd(n, d) = 1) with d ≤ 1,000,000.

## My solution

The number of reduced fractions with denominator d is Euler's totient φ(d), so the answer is φ(2) + φ(3) + … + φ(1,000,000). I compute each φ(d) separately:

1. **Factor d by trial division**: divide out 2, then try every odd p until nothing is left, recording each prime's exponent in a `HashMap`.
2. **Totient of the radical by inclusion–exclusion.** Let r be the product of the distinct primes. Then φ(r) = r − Σ r/p + Σ r/(pq) − … over all subsets of those primes. `calculate` enumerates the subsets by walking the bitmasks 1 … 2ᵏ−1 (via `Integer.toBinaryString`) and builds a `Tuple` holding the subset's product and a parity flag that decides whether r/product is added or subtracted.
3. **Scale up for repeated factors**: multiply by p^(e−1) for each prime, since φ(d) = φ(r) · d/r.

```java
for(Tuple tuple : tuples) {
  if(tuple.even)
    count += simple/tuple.value;
  else
    count -= simple/tuple.value;
}

for(Integer factor : map.keySet()) {
  count *= ((int) Math.pow(factor, map.get(factor) - 1));
}
```

The running total goes into a `long`. Each φ(d) fits in an `int`, and there's a sanity check that throws if one ever comes out negative.
