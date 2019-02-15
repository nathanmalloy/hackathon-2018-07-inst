(function(exports) {

  let engine

  const players = []

  let previousCollisions = []

  const width = 800
  const height = 600
  const balloonSize = 16 * 1.5

  const gravity = 0.00012
  const epsilon = 0.000001
  const playerMaxVelocity = { x: 0.2, y: 0.15 }
  const playerMaxRiseSpeed = 0.2
  const playerAccelX = playerMaxVelocity.x * 0.0008
  const thrust = -0.0004
  const fuelUsageRate = 0.2
  const fuelRefillRate = 1.0
  const bounce = 0.95
  const wallBounce = 0.8
  const airDrag = { x: 0.0001 }

  exports.width = width
  exports.height = height
  exports.initWorld = () => {

    const boundaryThickness = 10
    const floor = {
      x: width / 2,
      y: height,
      width: width,
      height: boundaryThickness
    }
    const underfloor = {
      ...floor,
      y: floor.y + height * 0.5
    }
    const wallL = {
      x: 0,
      y: height / 2,
      width: boundaryThickness,
      height: height
    }
    const wallR = {
      x: width,
      y: height / 2,
      width: boundaryThickness,
      height: height
    }
    const ceiling = {
      x: width / 2,
      y: 0 + balloonSize,
      width: width,
      height: boundaryThickness
    }

    engine = {
      world: {
        floor,
        underfloor,
        wallL,
        wallR,
        ceiling,
        platforms: [],
        gravity
      },

    }
    exports.engine = engine

    players.forEach((p, i) => {
      p.position.x = width / (players.length + 1) * (i + 1)
      p.position.y = 400
    })
  }
  exports.createPlayer = (id, name, skinId) => {
    const startPos = { x: 100, y: 100 }
    const width = 32 * 2
    const height = 32 * 2

    const hitbox = {
      x: 0,
      y: 0,
      width: 28,
      height,
    }

    const player = {
      id: id,
      name,
      skinId,
      get hitbox() { return {
        ...hitbox,
        x: this.isFacingRight ? this.position.x + hitbox.x : this.position.x - hitbox.x,
        y: this.position.y + hitbox.y,
      }},
      isAlive: true,
      isFacingRight: true,
      isThrusting: false,
      score: 0,
      width: width,
      height: height,
      position: startPos,
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      fuel: 0.5,
      balloons: 2,
      balloonSize,
      balloonOffsets: [
        { x: balloonSize * -0.5, y: -height * 0.5 - balloonSize * 0.6 },
        { x: balloonSize *  0.5, y: -height * 0.5 - balloonSize * 0.6 }
      ],
      get balloonHitbox() { return {
        x: this.position.x,
        y: this.position.y + this.balloonOffsets[0].y,
        width: hitbox.width,
        height: balloonSize,
      }},
      moveX(input) {
        if (this.isAlive) {
          const clampedInput = clamp(input, -1, 1)

          this.acceleration.x = clampedInput * playerAccelX

          if (clampedInput > epsilon) {
            this.isFacingRight = true
          } else if (clampedInput < -epsilon) {
            this.isFacingRight = false
          }
        }
      },
      thrusting(thrustInput) {
        if (this.isAlive) {
          this.acceleration.y = thrustInput ? thrust : 0
          this.isThrusting = thrustInput && this.fuel > 0
        }
      },
      setPosition(x, y) {
        this.position.x = x
        this.position.y = y
      },
      setVelocity(x, y) {
        this.velocity.x = x
        this.velocity.y = y
        if (Math.abs(x) < epsilon) {
          this.velocity.x = 0
        }
      },
      setAcceleration(x, y) {
        this.acceleration.x = x
        this.acceleration.y = y
      },
    }
    players.push(player)
    return player
  }
  exports.removePlayer = (playerId) => {
    const playerIndex = players.findIndex(p => p.id === playerId)
    if (playerIndex > -1) {
      players.splice(playerIndex, 1)
    }
  }
  exports.update = (delta) => {

    players.forEach(p => {
      if (p.acceleration.y > thrust) {
        p.isThrusting = false
      }
      if (p.fuel === 0) {
        p.acceleration.y = 0
        p.isThrusting = false
      }
      if (p.isThrusting) {
        p.fuel = clamp(p.fuel - fuelUsageRate * delta / 1000, 0, 1)
      }

      const acceleration = { x: p.acceleration.x, y: p.acceleration.y + engine.world.gravity }
      if (p.velocity.x > epsilon) {
        acceleration.x -= airDrag.x < p.velocity.x / delta ? airDrag.x : 0
      } else if (p.velocity.x < -epsilon) {
        acceleration.x += airDrag.x < -p.velocity.x / delta ? airDrag.x : 0
      }
      const velocityX = clamp(p.velocity.x + acceleration.x * delta, -playerMaxVelocity.x, playerMaxVelocity.x)
      const velocityY = clamp(p.velocity.y + acceleration.y * delta, -playerMaxRiseSpeed, playerMaxVelocity.y)

      p.setVelocity(velocityX, velocityY)
      p.setPosition(p.position.x + p.velocity.x * delta, p.position.y + p.velocity.y * delta)
    })

    players.forEach(p => {
      let overlap
      if (overlap = isColliding(p.hitbox, p.isAlive ? engine.world.floor : engine.world.underfloor)) {
        p.position.y -= overlap.y
        p.velocity.y = 0

        p.fuel = clamp(p.fuel + fuelRefillRate * delta / 1000, 0, 1)
      }
      if (overlap = isColliding(p.hitbox, engine.world.wallL)) {
        p.position.x += overlap.x
        p.velocity.x *= -wallBounce
      }
      if (overlap = isColliding(p.hitbox, engine.world.wallR)) {
        p.position.x -= overlap.x
        p.velocity.x *= -wallBounce
      }
      if (overlap = isColliding(p.hitbox, engine.world.ceiling)) {
        p.position.y += overlap.y
        p.velocity.y *= -wallBounce
      }
    })

    const frameCollisions = []
    players.forEach(p => {
      if (!p.isAlive) {
        return
      }

      const legsHitbox = {
        x: p.hitbox.x,
        y: p.hitbox.y + p.hitbox.height / 2,
        width: p.hitbox.width,
        height: p.hitbox.height / 2,
      }

      players.forEach(p2 => {
        if (p === p2 || !p2.isAlive) {
          return
        }

        if (overlap = isColliding(legsHitbox, p2.balloonHitbox)) {
          frameCollisions.push({ p, p2 })

          console.log(overlap)
          const separatedAxis = separate(p, p2, overlap)

          if (previousCollisions.find(c => collisionMatch(c, p, p2))) {
            return // wait for collision to end before triggering again
          }

          if (separatedAxis.x) {
            p.velocity.x *= -bounce
            p2.velocity.x *= -bounce
          }
          if (separatedAxis.y) {
            p.velocity.y *= -bounce
            p2.velocity.y *= -bounce
          }

          p2.balloons -= 1
          if (p2.balloons === 0) {
            p2.isAlive = false
            p2.isThrusting = false
            p2.setAcceleration(0, 0)
          }
        } 
        else if (overlap = isColliding(p.hitbox, p2.hitbox)) {
          frameCollisions.push({ p, p2 })
          // collided without attacking
          const separatedAxis = separate(p, p2, overlap)

          if (previousCollisions.find(c => collisionMatch(c, p, p2))) {
            return // wait for collision to end before triggering again
          }

          if (separatedAxis.x) {
            p.velocity.x *= -bounce
            p2.velocity.x *= -bounce
          }
          if (separatedAxis.y) {
            p.velocity.y *= -bounce
            p2.velocity.y *= -bounce
          }
        }
      })
    })
    previousCollisions = frameCollisions
  }

  exports.getWinnerName = () => {
    const livingPlayers = players.filter(p => p.isAlive)
    if (livingPlayers.length === 1) {
      const winner = livingPlayers[0]
      return winner.name
    }
  }

  exports.reset = () => {
    players.length = 0
  }

  function isColliding(a, b) {
    if (Math.abs(a.x - b.x) > (a.width + b.width) / 2) {
      return false
    } else if (Math.abs(a.y - b.y) > (a.height + b.height) / 2) {
      return false
    }

    return {
      x: a.x < b.x ? (a.x + a.width / 2) - (b.x - b.width / 2) : (b.x + b.width / 2) - (a.x - a.width / 2),
      y: a.y < b.y ? (a.y + a.height / 2) - (b.y - b.height / 2) : (b.y + b.height / 2) - (a.y - a.height / 2)
    }
  }

  function separate(a, b, overlap) {
    function separateX(a, b, overlap) {
      if (a.position.x < b.position.x) {
        a.position.x -= overlap.x / 2
        b.position.x += overlap.x / 2
      }
      else {
        a.position.x += overlap.x / 2
        b.position.x -= overlap.x / 2
      }
    }

    function separateY(a, b, overlap) {
      if (a.position.y < b.position.y) {
        a.position.y -= overlap.y / 2
        b.position.y += overlap.y / 2
      } else {
        a.position.y += overlap.y / 2
        b.position.y -= overlap.y / 2
      }
    }

    if (overlap.x < overlap.y) {
      separateX(a, b, overlap)
      return { x: true, y: false }
    } else if (overlap.y < overlap.x) {
      separateY(a, b, overlap)
      return { x: false, y: true }
    } else {
      separateX(a, b, overlap)
      separateY(a, b, overlap)
      return { x: true, y: true }
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max)
  }

  function collisionMatch(c, p, p2) {
    return (c.p === p && c.p2 === p2) || (c.p === p2 && c.p2 === p)
  }

  exports.players = players

})((typeof process === 'undefined' || !process.versions)
 ? window.core = window.core || {}
 : exports, (typeof process === 'undefined' || !process.versions)
 ? null || {}
 : null);
