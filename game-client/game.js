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

// var game = new Phaser.Game(config);

// let socket

let cursors
let spacebar
let ground
let player
// let playerId
const opponents = {}
const emitterOffset = { x: -0.25, y: 0.25 }

function preload ()
{
  this.load.image('sky', 'assets/sky.png');
  this.load.spritesheet('panda', 'assets/panda-arm.png', { frameWidth: 32, frameHeight: 32 })
  this.load.image('balloon', 'assets/balloon-highlight.png')
}

function create ()
{
  // socket = io()

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
  
  // socket.on('onconnected', data => {
  //   playerId = data.id
  //   console.log(`Connected to server. ID: ${playerId}`)
    player = createPlayer.bind(this)(playerId, startingPlayers.find(p => p.id === playerId))

    startingPlayers.filter(p => p.id !== playerId).forEach((p) => {
      const opponent = createPlayer.bind(this)(p.id, p)
      opponents[p.id] = opponent
    })
  // })

  // socket.on('player-joined', (data) => {
  //   console.log('player joined!', data.id)
  //   const opponent = createPlayer.bind(this)(data.id)
  //   opponents[data.id] = opponent
  // })
  
  socket.on('player-left', data => {
    console.log('player left!', data.id)
    opponents[data.id].balloonSprites.forEach(b => b.destroy())
    opponents[data.id].nameTag.destroy()
    opponents[data.id].sprite.destroy()
    opponents[data.id] = null
  })

  socket.on('update', data => {
    data.players.forEach(p => {
      if (player && p.id === player.id) {
        syncPlayer(player, p)
      } else {
        syncPlayer(opponents[p.id], p)
      }
    })
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
      player: playerId,
      x: xInput
    })
    player.moveX(xInput)
  }

  thrustInput = cursors.up.isDown || spacebar.isDown

  if (thrustInput !== lastThrustInput) {
    lastThrustInput = thrustInput
    socket.emit('thrust', {
      player: playerId,
      thrusting: thrustInput
    })
    player.thrusting(thrustInput)
  }
}

function syncPlayer(player, data) {
  player.name = data.name
  player.setPosition(data.position.x, data.position.y)
  player.setVelocity(data.velocity.x, data.velocity.y)
  player.isAlive = data.isAlive
  player.isFacingRight = data.isFacingRight
  player.isThrusting = data.isThrusting
  player.balloons = data.balloons
  syncSprite(player)
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

  player.nameTag.setPosition(player.position.x, player.position.y + player.height / 2)
}

function createPlayer(id, data) {
  const player = core.createPlayer(id)

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
    emitter,
    balloonSprites,
    nameTag
  }
}
