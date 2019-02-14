
socket.on('onconnected', data => {
  playerId = data.id
  console.log(`Connected to server. ID: ${playerId}`)
})

socket.emit('join', {
  name: 'Sample Bot',
  skinId: 'lime'
})

socket.on('started', data => {
  // core is optional, but useful for tracking opponents between server updates
  core.initWorld()

  data.players.forEach(p => {
    core.createPlayer(p.id, p.name, p.skinId)
  })

  let lastUpdateTime = 0
  socket.on('update', data => {
    const timestamp = new Date(data.timestamp)
    if (lastUpdateTime < timestamp) {
      lastUpdateTime = timestamp
      
      data.players.forEach(p => {
        const corePlayer = core.players.find(cp => cp.id === p.id)
        core.players[core.players.indexOf(corePlayer)] = {
          ...corePlayer,
          ...p,
        }
      })
    }
  })

  socket.on('player-left', data => {
    core.removePlayer(data.id)
  })

  socket.on('game-over', data => {
    clearInterval(coreUpdateLoop)
  })

  let lastCoreUpdate = new Date()
  const coreUpdateLoop = setInterval(() => {
    const time = new Date()
    const delta = time - lastCoreUpdate
    lastCoreUpdate = time

    makeDecisions()
    // core.update(time, delta)
  }, 1000 / 60)
})

function makeDecisions() {
  // world boundaries are in core.engine.world
  // players (including yourself) are in core.players

  const self = core.players.find(p => p.id === playerId)
  const isGrounded = self.position.y + self.height >= core.engine.world.floor.y

  const option = Math.random()
  if (option < 0.01) {
    socket.emit('move-x', { x: 0, timestamp: new Date() })
  } else if (option < 0.015) {
    socket.emit('move-x', { x: -1, timestamp: new Date() })
  } else if (option < 0.020) {
    socket.emit('move-x', { x: 1, timestamp: new Date() })
  }

  if (isGrounded) {
    if (self.fuel === 1 && !self.isThrusting) {
      socket.emit('thrust', { thrusting: true, timestamp: new Date() })
    } else if (!self.isThrusting) {
      socket.emit('thrust', { thrusting: false, timestamp: new Date() })
    }
  } else {
    if (option < 0.03) {
      socket.emit('thrust', { thrusting: false, timestamp: new Date() })
    } else if (option < 0.1 && !isGrounded) {
      socket.emit('thrust', { thrusting: true, timestamp: new Date() })
    }
  }
}
