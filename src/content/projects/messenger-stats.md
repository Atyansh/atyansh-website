---
title: 'Messenger Stats'
description: 'Python script to analyze Facebook Messenger conversations, generating detailed statistics and word clouds from your chat history.'
technologies: ['Python', 'Data Analysis', 'WordCloud', 'JSON Processing']
featured: false
startDate: 2017-06-01
links:
  github: 'https://github.com/atyansh/messenger-stats'
---

# Messenger Stats

A Python-based tool for analyzing Facebook Messenger conversation data. Extract insights, generate statistics, and create visual word clouds from your chat history.

## Features

- **Conversation Analysis**: Compute detailed metrics on your messenger conversations
- **Word Cloud Generation**: Create visual representations of the most frequently used words
- **JSON Data Processing**: Parse Facebook's exported messenger data format
- **Customizable Output**: Configure word cloud dimensions and filtering thresholds

## How It Works

1. Export your Facebook messenger data in JSON format from Facebook's data download tool
2. Install required Python dependencies (primarily `wordcloud`)
3. Configure analysis settings in `constants.py`
4. Run the script to generate statistics and visualizations

## Use Cases

- Understanding conversation patterns with friends
- Analyzing communication trends over time
- Creating fun word clouds from long chat histories
- Data visualization of messaging habits

## Technical Details

The script processes JSON-formatted messenger data exports and uses Python's data processing capabilities to extract meaningful statistics. Word clouds are generated using the WordCloud library with customizable parameters.

## Source Code

View the project on [GitHub](https://github.com/atyansh/messenger-stats).
