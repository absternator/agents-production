import 'dotenv/config'
import { Index as UpstashIndex } from '@upstash/vector'
import { parse } from 'csv-parse/sync'
import fs from 'fs'
import path from 'path'
import ora from 'ora'

const index = new UpstashIndex({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
})

export async function indexMovieData() {
  const spinner = ora('Indexing movie data...').start()

  const csvPath = path.join(process.cwd(), 'src/rag/imdb_movie_dataset.csv')
  const csvData = fs.readFileSync(csvPath, 'utf-8')
  const records = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
  })

  spinner.text = `Indexing ${records.length} records...`

  const batchSize = 50

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const vectors = batch.map((movie) => {
      const text = `${movie.Title}. ${movie.Genre}. ${movie.Description}`

      return {
        id: movie.Title, // Using Rank as unique ID
        data: text, // Text will be automatically embedded
        metadata: {
          title: movie.Title,
          year: Number(movie.Year),
          genre: movie.Genre,
          director: movie.Director,
          actors: movie.Actors,
          rating: Number(movie.Rating),
          votes: Number(movie.Votes),
          revenue: Number(movie.Revenue),
          metascore: Number(movie.Metascore),
        },
      }
    })

    try {
      await index.upsert(vectors)
    } catch (error) {
      spinner.fail(`Failed to index batch starting at record ${i}: ${error}`)
      console.error(error)
    }
  }

  spinner.succeed('Indexing complete!')
}

indexMovieData()
