//// FILL ME /////
const apikey = '' // your api key

console.time('Elapsed time')
const episode = {
  title: 'Game of Thrones',
  type: 'episode',
  ids: {
    tvdb: 121361, 
    imdb: 'tt0944947', 
    tmdb: 1399, 
    season: 1,
    episode: 1
  }
}

const tmdb = new (require('./tmdb.js'))({
  apiv3: apikey
})

tmdb.tv.episode.images({tv_id: episode.ids.tmdb, season: episode.ids.season, episode: episode.ids.episode}).then(res => {
  console.log('Got response', res)
  console.timeEnd('Elapsed time')
}).catch(console.error)