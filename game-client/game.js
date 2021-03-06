var config = {
  type: Phaser.AUTO,
  width: core.width,
  height: core.height,
  scene: {
      preload: preload,
      create: create,
      update: update
  }
};

let cursors
let spacebar
let ground
let player
let amIAlive = true
const opponents = {}
const emitterOffset = { x: -0.25, y: 0.25 }

function preload ()
{
  this.load.image('sky', 'assets/sky.png');
  this.load.spritesheet('panda', 'assets/panda-empty.png', { frameWidth: 32, frameHeight: 32 })
  this.load.image('balloon', 'assets/balloon-highlight.png')
}

function create ()
{
  core.initWorld()

  this.add.image(0, 0, 'sky')
    .setOrigin(0, 0)
    .setDisplaySize(core.width, core.height)

  this.anims.create({
    key: 'panda-right',
    frames: this.anims.generateFrameNumbers('panda', { start: 0, end: 0 }),
    frameRate: 2,
    repeat: -1
  })
  
  cursors = this.input.keyboard.createCursorKeys()
  spacebar = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Spacebar)
  
  if (!isSpectator) {
    player = createPlayer.bind(this)(playerId, startingPlayers.find(p => p.id === playerId))
  }

  startingPlayers.filter(p => p.id !== playerId).forEach((p) => {
    const opponent = createPlayer.bind(this)(p.id, p)
    opponents[p.id] = opponent
  })
  
  socket.on('player-left', data => {
    console.log('player left!', data.name)
    core.removePlayer(data.id)
    opponents[data.id].sprite.destroy()
    opponents[data.id].particles.destroy()
    opponents[data.id].balloonSprites.forEach(b => b.destroy())
    opponents[data.id].fuelTank.destroy()
    opponents[data.id].nameTag.destroy()
    opponents[data.id] = null
  })

  let lastUpdateTime = 0
  socket.on('update', data => {
    const timestamp = new Date(data.timestamp)
    if (lastUpdateTime < timestamp) {
      lastUpdateTime = timestamp

      data.players.forEach(p => {
        if (player && p.id === player.id) {
          syncPlayer(player, p, isLocalPlayer = true)

          if (amIAlive && !p.isAlive) {
            const rank = 1 + data.players.filter(pp => pp.isAlive).length
            showRankText.bind(this)(rank)
            amIAlive = false
          }
        } else {
          syncPlayer(opponents[p.id], p, isLocalPlayer = false)
        }
      })
    }
  })

  socket.on('game-over', data => {
    if (!player) {
      // show name of victor for spectators
      showWinnerText.bind(this)(data.winner)
    }

    setTimeout(() => {
      window.location.reload()
    }, 5000)
  })
}

function update (time, delta) {
  if (player) { 
    handleInput()
  }
  core.update(delta)

  if (player) {
    syncSprite(player)
  }
  Object.keys(opponents).forEach(o => {
    if (opponents[o]) {
      syncSprite(opponents[o])
    }
  })
}

let lastXInput = 0
let lastThrustInput = false
function handleInput() {
  let xInput
  if (cursors.left.isDown) {
    xInput = -1
  } else if (cursors.right.isDown) {
    xInput = 1
  } else {
    xInput = 0
  }

  if (xInput !== lastXInput) {
    lastXInput = xInput
    socket.emit('move-x', {
      x: xInput,
      timestamp: new Date() // what if server and client are on different times?
    })
    player.moveX(xInput)
  }

  thrustInput = cursors.up.isDown || spacebar.isDown

  if (thrustInput !== lastThrustInput) {
    lastThrustInput = thrustInput
    socket.emit('thrust', {
      thrusting: thrustInput,
      timestamp: new Date()
    })
    player.thrusting(thrustInput)
  }
}

function syncPlayer(player, data, isLocalPlayer) {
  player.name = data.name
  player.setPosition(data.position.x, data.position.y)
  player.setVelocity(data.velocity.x, data.velocity.y)
  player.isAlive = data.isAlive
  player.isThrusting = data.isThrusting
  player.balloons = data.balloons
  player.fuel = data.fuel

  if (!isLocalPlayer) {
    player.isFacingRight = data.isFacingRight
    syncSprite(player)
  }
}

function ordinal(rank) {
  // for 1 or 2 digits
  if (rank === 11 || rank === 12 || rank === 13) {
    return `${rank}th`
  }
  const n = rank % 10
  if (n === 1) return `${rank}st`
  if (n === 2) return `${rank}nd`
  if (n === 3) return `${rank}rd`
  return `${rank}th`
}

function syncSprite(player) {
  player.sprite.setPosition(player.position.x, player.position.y)
  player.sprite.setFlipX(!player.isFacingRight)

  player.emitter.on = player.isThrusting
  if (!player.isFacingRight) {
    player.emitter.followOffset.x = player.width * -emitterOffset.x
  } else {
    player.emitter.followOffset.x = player.width * emitterOffset.x
  }

  player.balloonSprites.forEach((b, i) => {
    if (player.balloons > i) {
      const offset = player.balloons == 2 ? player.balloonOffsets[i] : { x: 0, y: player.balloonOffsets[0].y }
      b.setPosition(player.position.x + offset.x, player.position.y + offset.y)
    } else {
      if (b.active) {
        b.setActive(false)
        b.setVisible(false)
      }
    }
  })

  const fuelTankXOffset = scaleToPlayerSprite(6, player.width) * (player.isFacingRight ? 1 : -1)
  player.fuelTank.setPosition(player.position.x - fuelTankXOffset, player.position.y + scaleToPlayerSprite(7, player.height))
  player.fuelTank.scaleY = player.fuel

  player.nameTag.setPosition(player.position.x, player.position.y + player.height / 2)
}

function createPlayer(id, data) {
  const player = core.createPlayer(id, data.name)

  const fuelTank = this.add.rectangle(
    player.position.x - scaleToPlayerSprite(6, player.width),
    player.position.y + scaleToPlayerSprite(7, player.height),
    scaleToPlayerSprite(8, player.width),
    scaleToPlayerSprite(10, player.height),
    getFuelColor(data.skinId)
  )
  fuelTank.displayOriginY = scaleToPlayerSprite(10, player.height)

  const sprite = this.add.image(player.position.x, player.position.y, 'panda', 0)
  // sprite.displayOriginX = 0
  // sprite.displayOriginY = 0
  sprite.displayWidth = player.width
  sprite.displayHeight = player.height
  // sprite.displayOriginX = player.width / 2
  // sprite.displayOriginY = player.height / 2

  const particles = this.add.particles('panda')
  const emitter = particles.createEmitter({
    on: false,
    speed: 50,
    scale: { start: 0.5, end: 0 },
    gravityY: 10,
    angle: { min: 90 - 15, max: 90 + 15},
    // radial: false,
    blendMode: 'ADD',
  })
  emitter.startFollow(sprite, player.width * emitterOffset.x, player.height * emitterOffset.y)

  const balloonSprites = []
  for (let i = 0; i < player.balloons; i++) {
    const offset = player.balloonOffsets[i]
    const balloon = this.add.image(player.position.x + offset.x, player.position.y + offset.y, 'balloon')
    balloon.displayWidth = player.balloonSize
    balloon.displayHeight = player.balloonSize
    balloonSprites.push(balloon)
  }

  const nameTag = this.add.text(player.position.x, player.position.y + player.height / 2, data.name)
  nameTag.setOrigin(0.5, 0)

  return {
    ...player,
    sprite,
    particles,
    emitter,
    balloonSprites,
    fuelTank,
    nameTag
  }
}

function scaleToPlayerSprite(pixel, playerDimension) {
  return Math.floor((pixel / 32) * playerDimension)
}

const skins = {
  pure: { name: 'pure', fuelColor: 0xccf6ff },
  lemon: { name: 'lemon', fuelColor: 0xf6ffcc },
  lime: { name: 'lime', fuelColor: 0xccffd0 },
  berry: { name: 'berry', fuelColor: 0xe9ccff },
  orange: { name: 'orange', fuelColor: 0xfff2cc },
  'cran-rasp': { name: 'cran-rasp', fuelColor: 0xffcce5 },
}

function getFuelColor(skinId) {
  return skins[skinId].fuelColor
}

function showWinnerText(winnerName) {
  const winnerText = this.add.text(core.width / 2, core.height / 2, `${winnerName}\nWins!`, { align: 'center', fontSize: 48 })
  winnerText.setOrigin(0.5, 0.5)
}

function showRankText(rank) {
  const rankText = this.add.text(core.width / 2, core.height / 2, `You placed ${ordinal(rank)}`, { align: 'center', fontSize: 48 })
  rankText.setOrigin(0.5, 0.5)
}
