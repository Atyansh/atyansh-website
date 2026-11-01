---
title: 'Messenger Stats'
description: 'Turns a Facebook Messenger chat export into per-person stats and word clouds: who sends the most messages, photos, GIFs and stickers, and who writes the most.'
technologies: ['Python', 'wordcloud']
featured: false
startDate: 2019-06-01
links:
  github: 'https://github.com/atyansh/messenger-stats'
---

Facebook lets you download your entire Messenger history as JSON, one file per conversation. I wrote this script in 2019 to settle the obvious questions about a group chat: who actually talks the most, who sends all the GIFs, who's the sticker person, and what everyone's favourite words are.

## What it reports

For every person in a chat, and for the chat as a whole:

- messages sent, by type (regular messages, shared links, calls)
- stickers, photos, videos, GIFs, files and audio clips sent
- total words written, and how many of them are longer words
- a word cloud of the words they use most

## How it works

`parse.py` walks the conversation's `messages` array once. Each sender gets a `Person` with a dictionary of counters, and every count is also added to a "Total" participant, so the whole-chat numbers come out of the same pass. Attachments are counted by the length of each attachment list, since one message can carry several photos.

Text is uppercased and stripped of punctuation before it's split into words, so "Hey!" and "hey" count as the same word:

```python
filtered = re.sub(r'[^\w\s]','',content).upper()
for word in filtered.split():
    update(word, participant)
    update(word, total)
    participant.content.append(word)
    if len(word) >= MIN_WORD_LENGTH:
        participant.filteredContent.append(word)
```

The word clouds use the [`wordcloud`](https://github.com/amueller/word_cloud) library on each person's longer words. A minimum length of 4 to 6 letters gave the best-looking clouds, since it filters out "the", "and" and "lol". The settings (which chat, word length, stats or clouds) live in `constants.py`.

The chat data itself never goes near the repo: `.gitignore` excludes the export's JSON and media folders.
