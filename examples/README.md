# API Examples

This folder contains example requests for the Arabic Lemmatizer API.

## Postman Collection

The `postman_collection.json` file contains a collection of example requests that you can import into Postman. The collection includes examples for all available endpoints:

1. **Lemmatize Text** (`POST /lemmatize`)

   - Lemmatizes Arabic text and returns the lemmatized version along with word-lemma mappings
   - Example text: "مرحبا بالعالم" (Hello World)

2. **Check Vocabulary** (`POST /check`)

   - Checks which words in the text are known/unknown in the vocabulary
   - Uses the same example text

3. **Update Known Words** (`PUT /update-known`)

   - Updates the known/unknown status of words in the vocabulary
   - Example marks "مرحبا" as unknown

4. **Get All Vocabulary** (`GET /vocab`)

   - Retrieves all vocabulary entries

5. **Get Known Vocabulary** (`GET /vocab/known`)

   - Retrieves only known vocabulary entries

6. **Get Unknown Vocabulary** (`GET /vocab/unknown`)
   - Retrieves only unknown vocabulary entries

## How to Use

1. Open Postman
2. Click "Import" and select the `postman_collection.json` file
3. Make sure the API server is running on `localhost:8000`
4. Try out the example requests

## Example Response Format

### Lemmatize Response

```json
{
  "lemmatized_text": "مرحبا+بالعالم",
  "words": [
    {
      "word": "مرحبا",
      "lemma": "مرحبا",
      "lemma_parts": ["مرحبا"]
    },
    {
      "word": "بالعالم",
      "lemma": "بالعالم",
      "lemma_parts": ["بالعالم"]
    }
  ]
}
```

### Check Response

```json
{
  "lemmatized_text": "مرحبا+بالعالم",
  "words": [
    {
      "word": "مرحبا",
      "lemma": "مرحبا",
      "lemma_parts": [
        {
          "part": "مرحبا",
          "is_known": false,
          "count": 1
        }
      ],
      "is_known": false
    },
    {
      "word": "بالعالم",
      "lemma": "بالعالم",
      "lemma_parts": [
        {
          "part": "بالعالم",
          "is_known": false,
          "count": 1
        }
      ],
      "is_known": false
    }
  ]
}
```

### Vocabulary Response

```json
[
  {
    "lemma_part": "مرحبا",
    "is_known": false,
    "count": 1,
    "last_seen": "2024-03-21T12:34:56"
  }
]
```
