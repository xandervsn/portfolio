# LSAT Online Test Environment

A practice version of the LSAT online administration system that supports custom test content via JSON format.

## Features

- **Reading Comprehension (RC)**: Support for up to 4 passages with 5-8 questions each
- **Logical Reasoning (LR1 & LR2)**: Two separate LR sections with individual questions
- **Custom JSON Input**: Load your own test content via JSON files or text input
- **Full Test Simulation**: 4 sections with timing, breaks, and scoring

=======
## JSON Format

### Complete Test Structure

```json
{
  "RC": {
    "timeLimit": 35,
    "passages": [...]
  },
  "LR1": {
    "timeLimit": 35,
    "questions": [...]
  },
  "LR2": {
    "timeLimit": 35,
    "questions": [...]
  }
}
```

### Reading Comprehension (RC)

```json
{
  "RC": {
    "timeLimit": 35,
    "passages": [
      {
        "title": "Passage Title",
        "content": "Full passage text...",
        "questions": [
          {
            "text": "Question text?",
            "choices": [
              "Choice A",
              "Choice B", 
              "Choice C",
              "Choice D",
              "Choice E"
            ],
            "correct": 0
          }
        ]
      }
    ]
  }
}
```

### Logical Reasoning (LR1 & LR2)

```json
{
  "LR1": {
    "timeLimit": 35,
    "questions": [
      {
        "stimulus": "Argument or stimulus text...",
        "text": "Question text?",
        "choices": [
          "Choice A",
          "Choice B",
          "Choice C", 
          "Choice D",
          "Choice E"
        ],
        "correct": 0
      }
    ]
  }
}
```
