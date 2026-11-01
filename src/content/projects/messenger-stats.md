---
title: 'Messenger Stats'
description: "A Python 2 script that reads one conversation from Facebook's JSON data export and counts messages, attachments and words per person, with optional word clouds."
technologies: ['Python', 'wordcloud']
featured: false
startDate: 2019-06-01
links:
  github: 'https://github.com/atyansh/messenger-stats'
---

Facebook's "Download Your Information" tool can export your Messenger history as JSON, one `message_1.json` per conversation. I wrote this script over an afternoon in June 2019 to get some numbers out of a single chat: who sends the most messages, photos, GIFs and stickers, and who writes the most words.

## How it works

`parse.py` loads the file named in `constants.py` and walks the `messages` array. Each sender gets a `Person` object holding a dictionary of counters, and every count is also added to a synthetic "Total" participant, so the group totals come out of the same pass. It counts:

- messages by type (`Generic`, `Share`, `Call`)
- text messages and stickers (one each)
- photos, videos, GIFs, files and audio clips, counted by the length of each attachment list, since one message can carry several

Text from ordinary messages is split into words after stripping punctuation and uppercasing, so "Hey!" and "hey" count as the same word:

```python
filtered = re.sub(r'[^\w\s]','',content).upper()
for word in filtered.split():
    update(word, participant)
    update(word, total)
    participant.content.append(word)
    if len(word) >= MIN_WORD_LENGTH:
        participant.filteredContent.append(word)
```

With `PRINT_STATS` on, the script pretty-prints everyone's counters plus total words and words of at least `MIN_WORD_LENGTH` (4) letters. With `GENERATE_WORDCLOUD` on, it feeds each person's long-enough words to the `wordcloud` library and opens a 2000×1000 image per person (the README notes that cutoffs of 4 and 6 gave the best-looking results).

The `.gitignore` excludes `*.json` and the export's photo, video, GIF, audio and file folders, so the repo only ever held the code and none of the chat data.

## State

It's a one-day script and stayed that way. The per-word frequency table is built but never printed, reactions and timestamps are ignored, and the images are only displayed, not saved. `IDEAS.txt` lists what I didn't get to: reaction stats, weekly and time-of-day activity charts, and custom-coloured, custom-shaped word clouds per person. It's also Python 2 (`print` statements), so it won't run on a current Python without small changes.
