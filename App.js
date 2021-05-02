import React, {PureComponent} from 'react'
import {Dimensions, StatusBar, StyleSheet, Text, View} from 'react-native'
import Matter from 'matter-js'
import {GameEngine} from 'react-native-game-engine'
import {Entity} from './src/renderers/index'
import {
  INITIAL_GRAVITY,
  THEME_COLOR,
  DAY_INTERVAL,
  PLAYER_X_START,
  PLAYER_Y_FIXED,
  STARTING_CASH,
  PLAYER_ENTITY_WIDTH,
  PLAYER_ENTITY_HEIGHT,
  PLAYER_WIDTH_OFFSET,
  DEFAULT_ACCELERATOR_INTERVAL,
  ENTITY_DETAILS,
} from './src/constants/index'
import {Physics, Generator, Destroyer} from './src/systems/index'
import {removeEntity} from './src/helpers/index'
import {
  accelerometer,
  setLogLevelForType,
  setUpdateIntervalForType,
  SensorTypes,
} from 'react-native-sensors'
import {CircleButton} from './src/components/index'
import Images from './assets/index'
import {GameOverScreen, SettingsScreen} from './src/screens/index'

const {width, height} = Dimensions.get('screen')

export default class App extends PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      running: true,
      showSettings: false,
      // Initial game states
      interval: 0, // Game day interval
      cash: STARTING_CASH,
      daysLasted: 0,
      x: PLAYER_X_START,
      y: PLAYER_Y_FIXED,
    }

    this.gameEngine = null
    this.entities = this._setupWorld()
  }

  componentDidMount() {
    // Accelerometer refresh rate
    setUpdateIntervalForType(
      SensorTypes.accelerometer,
      DEFAULT_ACCELERATOR_INTERVAL,
    )

    setLogLevelForType(SensorTypes.accelerometer, 0)

    // Accelerometer event listener
    this.accelerometerSubscription = accelerometer.subscribe(({x}) => {
      if (!this.state.running) {
        return
      }

      const new_x = this.state.x - x

      // Prevent player entity from moving out of bounds
      if (new_x < PLAYER_WIDTH_OFFSET || new_x > width - PLAYER_WIDTH_OFFSET) {
        return
      }

      // Update player's position
      Matter.Body.setPosition(this.playerBox, {
        x: new_x,
        y: PLAYER_Y_FIXED,
      })

      this.setState({x: new_x})
    })
  }

  componentWillUnmount() {
    this.accelerometerSubscription.unsubscribe()
  }

  _setupWorld = () => {
    const engine = Matter.Engine.create({enableSleeping: false})
    const world = engine.world
    world.gravity.y = INITIAL_GRAVITY

    // Player entity
    this.playerBox = Matter.Bodies.rectangle(
      PLAYER_X_START,
      PLAYER_Y_FIXED,
      PLAYER_ENTITY_WIDTH,
      PLAYER_ENTITY_HEIGHT,
      {isStatic: true, label: 'player'},
    )

    Matter.World.add(world, this.playerBox)

    const playerEntity = this.playerBox.id

    // Collision event handling
    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach(({bodyA, bodyB}) => {
        const a = bodyA.id
        const b = bodyB.id
        let bodyToRemove = null
        let entityType = ''

        // Only interested in collision between player and other entities
        if (a !== playerEntity && b === playerEntity) {
          bodyToRemove = bodyA
          entityType = bodyA.label
        }
        if (b !== playerEntity && a === playerEntity) {
          bodyToRemove = bodyB
          entityType = bodyB.label
        }

        if (bodyToRemove) {
          // Remove the entity that collides with player
          removeEntity(bodyToRemove, this.entities)

          // Handle the collision effect
          if (this.gameEngine) {
            this.gameEngine.dispatch({
              type: 'entity-collision',
              entityType: entityType,
              xPos: bodyToRemove.position.x,
            })
          }
        }
      })
    })

    return {
      physics: {engine: engine, world: world},
      player: {
        body: this.playerBox,
        size: [PLAYER_ENTITY_WIDTH, PLAYER_ENTITY_HEIGHT],
        color: 'blue',
        renderer: Entity,
      },
      deleted: [],
    }
  }

  // Game mechanics happen here
  _onEvent = (e) => {
    switch (e.type) {
      case 'increment-day-interval':
        this._handleDayIncrement(e.value)
        break
      case 'entity-collision':
        this._handleEntityCollision(e.entityType, e.xPos)
        break
    }
  }

  _handleDayIncrement = (interval) => {
    this.setState(
      (prevState) => ({
        interval: prevState.interval + interval,
      }),
      () => {
        if (this.state.interval > DAY_INTERVAL) {
          this.setState((prev) => ({
            daysLasted: prev.daysLasted + 1,
            interval: 0,
          }))

          // Game over
          if (this.state.cash < 0) {
            this._gameOver()
          }
        }
      },
    )
  }

  _handleEntityCollision = (entityType) => {
    const entityDetails = ENTITY_DETAILS[entityType]

    // Calculate the effects of the entity
    this.setState((prevState) => ({
      cash: prevState.cash + entityDetails.cash,
    }))
  }

  _showSettings = () => {
    this.setState({running: false, showSettings: true})
  }

  _hideSettings = () => {
    this.setState({running: true, showSettings: false})
  }

  /**
   * Remove all non-player entities and prepare for a new game
   */
  _resetEntities = () => {
    Object.keys(this.entities).forEach((key) => {
      if (key !== 'physics' && key !== 'player' && key !== 'deleted') {
        Matter.Composite.remove(
          this.entities.physics.world,
          this.entities[key].body,
        )
        delete this.entities[key]
      }
    })

    this.entities.deleted = []
  }

  _gameOver = () => {
    this.setState({
      running: false,
    })
  }

  _reset = () => {
    this._resetEntities()
    this.setState({
      running: true,
      showSettings: false,
      // Initial game states
      interval: 0,
      cash: STARTING_CASH,
      daysLasted: 0,
      x: PLAYER_X_START,
      y: PLAYER_Y_FIXED,
    })
  }

  render() {
    const {cash, daysLasted, running, showSettings} = this.state

    const cashStyle = cash < 0 ? {color: '#9E0000'} : {color: 'green'}

    return (
      <View style={styles.container}>
        <StatusBar hidden={true} />
        <View style={styles.container}>
          <View style={styles.topContainer}>
            <View style={styles.statRow}>
              <View style={{flex: 3}}>
                <View style={styles.cashContainer}>
                  <Text style={[styles.cash, cashStyle]}>{cash}</Text>
                </View>
              </View>
              <CircleButton
                image={Images.settings}
                onPress={this._showSettings}
                borderStyle={styles.settingsBtnBorder}
                iconStyle={styles.settingsBtnIcon}
              />
            </View>
          </View>
          <GameEngine
            ref={(ref) => (this.gameEngine = ref)}
            style={styles.gameContainer}
            onEvent={this._onEvent}
            running={running}
            systems={[Physics, Generator, Destroyer]}
            entities={this.entities}
          />
          {!running && showSettings && (
            <SettingsScreen onPress={this._hideSettings} />
          )}
          {!running && !showSettings && (
            <GameOverScreen daysLasted={daysLasted} reset={this._reset} />
          )}
        </View>
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gameContainer: {
    position: 'absolute',
    top: height * 0.2,
    bottom: 0,
    left: 0,
    right: 0,
  },
  topContainer: {
    flexDirection: 'column',
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  statRow: {
    flex: 0.9,
    flexDirection: 'row',
  },
  cashContainer: {
    alignSelf: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  cash: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
  },
  settingsBtnBorder: {
    top: 10,
    height: 50,
    width: 50,
    zIndex: 2,
    marginRight: 10,
  },
  settingsBtnIcon: {
    width: 50,
    height: 50,
    tintColor: THEME_COLOR,
  },
})
