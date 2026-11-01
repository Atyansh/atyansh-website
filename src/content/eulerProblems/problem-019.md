---
problemNumber: 19
title: 'Counting Sundays'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler19.java'
---

## The problem

Count the months between January 1901 and December 2000 whose first day fell on a Sunday, using the Gregorian leap-year rules.

## My solution

Neither version uses a date library. Both start from the fact that 1 January 1901 was a Tuesday (the problem gives 1 January 1900 as a Monday, and 1900 has 365 days), with days of the week numbered 0 = Sunday … 6 = Saturday.

**Java (`Euler19.java`)** simulates the calendar one day at a time. It tracks `date`, `month`, `year` and `day`, counts whenever `date == 1 && day == 0`, and rolls the month over on day 29 of a non-leap February, day 30 of February, day 31 of the 30-day months, or day 32 of any month. `leap()` implements the full rule (divisible by 400, else not by 100, else by 4). That's about 36,500 iterations.

**Python (`Euler19.py`, Python 2, added in 2016)** steps a month at a time instead. It checks whether the current first-of-month is a Sunday, then advances the weekday by that month's length mod 7:

```python
for y in range(1901, 2001):
  for m in range(12):
    if day == 0:
      count += 1
    day = (day + month[m]) % 7
    if m == 1 and is_leap(y):
      day = (day + month[m]) % 7
```

That's 1,200 iterations instead of 36,500.

## Notes

The Python leap-year line has a bug: in a leap year it adds `month[1]` (28) a second time instead of adding 1, and 28 ≡ 0 (mod 7), so it does nothing. The script effectively ignores leap years. It still prints the correct count, so for this date range the missing leap days happen not to change the result. The Java version handles leap years properly.
