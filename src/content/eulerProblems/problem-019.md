---
problemNumber: 19
title: 'Counting Sundays'
difficulty: 5
solved: true
solutionLanguage: 'Java'
githubLink: 'https://github.com/atyansh/Project-Euler/blob/master/Euler19.java'
---

## Problem Statement

You are given the following information:
- 1 Jan 1900 was a Monday
- Thirty days has September, April, June and November
- All the rest have thirty-one
- Saving February alone, which has twenty-eight, rain or shine
- And on leap years, twenty-nine

A leap year occurs on any year evenly divisible by 4, but not on a century unless it is divisible by 400.

How many Sundays fell on the first of the month during the twentieth century (1 Jan 1901 to 31 Dec 2000)?

## Approach

**Method 1: Manual calculation**
- Start from 1 Jan 1900 (Monday)
- Iterate through each month from Jan 1901 to Dec 2000
- Track what day of the week it is
- Count when the first of the month is a Sunday

**Method 2: Using Java's date libraries**
- Use Calendar or LocalDate classes
- Iterate through each month in the range
- Check if the first day is a Sunday
- Count the occurrences

Key considerations:
- Correctly handle leap years (divisible by 4, except centuries unless divisible by 400)
- Account for varying month lengths
- Start counting from 1901, not 1900

The manual calculation approach helps understand the problem better, while the library approach is more concise and less error-prone.
