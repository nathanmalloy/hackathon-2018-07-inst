# hackathon-2018-07-inst
1 week Hackathon project, so excuse the rushed coding :)

Didn't have time to finish:
* Send binary instead of JSON
* Interpolate updates from the server to smooth position adjustments
* Save server updates from a couple frames ago to handle latency

## Usage

### Run the server

* `node start`

### Client

* open a web browser to `localhost:3000`
* Select a name and carbonated beverage flavor
* Click Join
* Open additional tabs/windows to add more players
* Click Start Game on any client

## Controls

Arrow Keys:

Left/Right: move
Up: jetpack thrust

## Client API

### `Player` object

id: string
name: string
skinId: string
isAlive: boolean
isFacingRight: boolean
isThrusting: boolean
balloons: number
fuel: number (0..1)
position: { x: number, y: number }
velocity: { x: number, y: number }

### on

#### `onconnected`

Successfully connected to server

Data: id: your connection's id

#### `joined`

You successfully joined the game. Patiently wait for other players to join (`player-joined`) or start the game (`start`).

Data: playerCount: the new total number of players who have joined

#### `player-joined`

A different player has joined the game. If everyone is here, `start` the game!

Data: playerCount: the new total number of players who have joined

#### `player-left`

A different player has disconnected.

Data:
id, name of the disconnecting player
playerCount: number of remaining players

#### `started`

Game start! `update` messages start coming in. Send your inputs with `move-x` or `thrust`.

Data: players: an array of the `Player`s in the game

#### `update`

The server's authoritative snapshot of each `Player`. Sent regularly several times per second after game starts.

Data:
timestamp: stringified Date the data was sent, in server time. Used for discarding old messages received out of order.
players: an array of the `Player`s in the game

#### `game-over`

Only one remains! Hopefully it is you.

Data: winner: Name of the winner

#### `rejected`

Joining the game failed for `reason`. Either the game was full or the game already started.

Data: reason: error message

### emit

#### `join`

Join a game if it has not started yet. You will get a `joined` event on success or a `rejected` event if the game is full or already started.

Args:
name: your name, will be displayed next to your character during the game
skinId: string name of your skin. Defaults to 'pure' if you don't specify anything.

#### `spectate`

Spectate a game if it has not started yet. You will get a `joined` event on success or a `rejected` event if the game is already started.

#### `start`

Start the game after all players have joined

#### `move-x`

Change your movement direction. You will continue moving this direction until you send another `move-x` command.

Args:
x: direction of movement. a number in the range [-1, 1], where -1 is left at max acceleration, 1 is right at max acceleration, and 0 is no acceleration.
timestamp: time the command was sent. Used for discarding old messages received out of order

#### `thrust`

Turn on/off your jet pack.

Args:
thrusting: boolean flag for whether you are turning your jet pack on or off
timestamp: time the command was sent. Used for discarding old messages received out of order

For the timestamp values, there is no need to sync your time with the server or other players, as long as you are consistent with yourself
