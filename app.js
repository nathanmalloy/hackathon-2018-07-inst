const express = require('express')
const http = require('http')
const sio = require('socket.io')
const path = require('path')
const uuid = require('node-uuid')
const core = require('./core')

const app = express()
const server = http.Server(app)
const io = sio(server)

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

    let lastMoveXMessageTime = 0 // don't use DateTime.now in case server and client clocks are different
    client.on('move-x', data => {
      if (gameInProgress) {
        // ignore older messages if they arrive out of order
        const timestamp = new Date(data.timestamp)
        if (lastMoveXMessageTime < timestamp) {
          lastMoveXMessageTime = timestamp

          player.moveX(data.x)
        }
      }
    })

    let lastThrustMessageTime = 0
    client.on('thrust', data => {
      if (gameInProgress) {
        const timestamp = new Date(data.timestamp)
        if (lastThrustMessageTime < timestamp) {
          lastThrustMessageTime = timestamp

          player.thrusting(data.thrusting)
        }
      }
    })

    client.emit('joined', { playerCount: players.length })
    client.broadcast.emit('player-joined', { id: client.userid, playerCount: players.length })
    console.log(` socket.io:: player connected: ${name} (${client.userid})`)
  })

  let physicsInterval, syncInterval
  client.on('start', data => {
    if (gameInProgress) {
      return
    }

    gameInProgress = true

    core.initWorld()
    let lastFrame = new Date()
    physicsInterval = setInterval(() => {  
      const currentTime = new Date()
      core.update((currentTime - lastFrame))
      lastFrame = currentTime
    }, 1000 / 50)

    syncInterval = setInterval(() => {
      io.emit('update', {
        players: getPlayerData(),
        timestamp: new Date()
      })
    }, 1000 / 20)

    io.emit('started', { players: getPlayerData() })
  })

  client.once('disconnect', () => {
    const playerIndex = players.findIndex(player => player.id === client.userid)
    console.log(playerIndex, 'player index')
    const player = players.splice(playerIndex, 1)
    core.removePlayer(player)

    console.log(` socket.io:: player disconnected: ${name} (${client.userid})`)

    io.emit('player-left', { id: client.userid, name: client.name })

    if (players.length === 0) {
      gameInProgress = false
      clearInterval(physicsInterval)
      clearInterval(syncInterval)
      console.log('Game stopped because all players disconnected')
    }
  })
})

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'game-client', 'index.html'))
})

app.get('/core.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'core.js'))
})

app.get('/game.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'game-client', 'game.js'))
})

app.get('/assets/*', (req, res) => {
  const file = req.params[0]
  res.sendFile(path.join(__dirname, 'game-client', 'assets', file))
})

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
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
