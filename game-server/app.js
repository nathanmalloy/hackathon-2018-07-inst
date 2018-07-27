const express = require('express')
const http = require('http')
const sio = require('socket.io')
const path = require('path')
const uuid = require('node-uuid')
// const matter = require('matter-js')
const core = require('./core')

const app = express()
const server = http.Server(app)
const io = sio(server)
// const Engine = matter.Engine

const hostname = '127.0.0.1'
const port = process.env.PORT || 3000

const maxPlayers = 8
const players = []
let gameInProgress = false

io.on('connection', client => {
  let name
  client.userid = uuid()
  client.emit('onconnected', { id: client.userid, playerCount: players.length })

  client.on('end', data => {
    gameInProgress = false
    players.length = 0
  })

  client.on('join', data => {
    name = data.name

    if (players.length >= maxPlayers) {
      console.log('rejected player because max reached')
      client.emit('rejected', { reason: 'max players reached' })
      return
    }

    if (gameInProgress) {
      console.log('rejected player because game in progress')
      client.emit('rejected', { reason: 'game in progress' })
      return
    }

    const player = core.createPlayer(client.userid, name)
    players.push({
      ...player,
      client
    })

    client.on('move-left', data => {
      if (gameInProgress) {
        player.moveLeft()
      }
    })

    client.on('move-right', data => {
      if (gameInProgress) {
        player.moveRight()
      }
    })

    client.on('thrust', data => {
      if (gameInProgress) {
        player.thrusting()
      }
    })

    client.emit('joined', { playerCount: players.length })
    client.broadcast.emit('player-joined', { id: client.userid, playerCount: players.length })
    console.log(` socket.io:: player connected: ${client.userid}`)
  })


  client.on('start', data => {
    if (gameInProgress) {
      return
    }

    client.on('disconnect', () => {
      const playerIndex = players.indexOf(client)
      const player = players.splice(playerIndex, 1)
      core.removePlayer(player)

      console.log(` socket.io:: player disconnected: ${client.userid}`)

      client.broadcast.emit('player-left', { id: client.userid })
    })

    gameInProgress = true

    core.initWorld()
    let lastFrame = new Date()
    setInterval(() => {  
      const currentTime = new Date()
      core.update((currentTime - lastFrame))
      lastFrame = currentTime
    }, 1000 / 60)

    setInterval(() => {
      io.emit('update', {
        players: getPlayerData()
      })
    }, 1000 / 20)

    io.emit('started', { players: getPlayerData() })
  })
})

app.get('/', (req, res) => {
  console.log('sending...')
  res.sendFile(path.join(__dirname, 'game-client', 'index.html'))
})

app.get('/core.js', (req, res) => {
  console.log('sending...')
  res.sendFile(path.join(__dirname, 'core.js'))
})

app.get('/*', (req, res) => {
  const file = req.params[0]
  res.sendFile(path.join(__dirname, 'game-client', file))
})

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`)
})

function getPlayerData() {
  return players.map(p => {
    const player = core.players.find(player => player.id === p.id)
    return {
      id: p.id,
      name: player.name,
      isAlive: player.isAlive,
      isFacingRight: player.isFacingRight,
      isThrusting: player.isThrusting,
      balloons: player.balloons,
      position: player.position,
      velocity: player.velocity,
    }
  })
}
