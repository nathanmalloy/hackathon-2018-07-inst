
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

    if (findSelf().isAlive) {
      makeDecisions()
      // core.update(time, delta)
    } else {
      // :(
      clearInterval(coreUpdateLoop)
    }
  }, 1000 / 60)
})

function findSelf() {
  return core.players.find(p => p.id === playerId)
}

function distanceFromSelf(self, opponent) {
  return Math.abs(self.position.x - opponent.position.x)
}

function distanceYFromSelf(self, opponent) {
  return Math.abs(self.position.y - opponent.position.y)
}

let lastMoveInput = 0
function makeDecisions() {
  // world boundaries are in core.engine.world
  // players (including yourself) are in core.players

  const self = findSelf()
  const opponents = core.players.filter(p => p.id !== playerId && p.isAlive)
  if (!opponents.length) return

  const nearestOpponentX = opponents.sort((a, b) => distanceFromSelf(self, a) - distanceFromSelf(self, b))[0]
  // opponents are now sorted by x distance
  const isGrounded = self.position.y + self.height >= core.engine.world.floor.y

  if (isGrounded) {
    refuelOnGroundThenTakeOff(self)
    return
  }

  if (nearestOpponentX.position.y < self.position.y - self.height / 2 || Math.random() < 0.05) {
    avoid(self, nearestOpponentX)
  } else {
    // if same height, thrust to get into stomping height
    thrust(distanceYFromSelf(self, nearestOpponentX) < self.height / 2)
    moveTowardNearestOpponent(self, nearestOpponentX)
  }
}

function moveLeft() {
  move(-1)
}

function moveRight() {
  move(1)
}

function dontMove() {
  move(0)
}

function move(direction) {
  if (lastMoveInput !== direction) {
    socket.emit('move-x', { x: direction, timestamp: new Date() })
    lastMoveInput = direction
  }
}

function thrust(up) {
  socket.emit('thrust', { thrusting: up, timestamp: new Date() })
}

function moveTowardNearestOpponent(self, nearestOpponentX) {
  if (nearestOpponentX.position.x > self.position.x + self.width / 2) {
    moveRight()
  } else if (nearestOpponentX.position.x < self.position.x - self.width / 2) {
    moveLeft()
  } else {
    dontMove()
  }
}

function avoid(self, nearestOpponentX) {
  if (distanceFromSelf(self, nearestOpponentX) < self.width) {
    if (nearestOpponentX.position.x > self.position.x) {
      moveLeft()
    } else {
      moveRight()
    }
  }
}


function refuelOnGroundThenTakeOff(self) {
  // assume isGrounded
  // fudge the fuel amount slightly to avoid stalemates with other bots (and be less predictable)
  const desiredFuel = 0.75 + Math.random() / 4
  if (self.fuel >= desiredFuel && !self.isThrusting) {
    thrust(true)
  } else if (!self.isThrusting) {
    thrust(false)
  }
}
