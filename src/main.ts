import "./style.css";
import { fromEvent, interval, merge, timer } from 'rxjs'; 
import { map, filter, scan, first } from 'rxjs/operators';

function main() {
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;

  //The keys we will use to control our game
  type Key = 'w' | 'a' | 's' | 'd' | 'r'
  //These are all the available objects in the game currently
  type ViewType = 'frog' | 'car' | 'planks' | 'river' | 'road' | 'destination' | 'crocodile' | 'turtle'

  class MoveHorizontal{constructor(public readonly position: number){}}
  class MoveVertical{constructor(public readonly position:number){}}
  class Tick{constructor(public readonly time: number){}}
  class Restart{constructor() {}}

  //Constants that we will use in our game
  const Constants = {
    CanvasSize: 600,
    FrogSpawnX: 280,
    FrogSpawnY: 560,
    RoadX: 0,
    RoadY: 350, 
    RoadHeight: 210,
    StartCarCount: 12,
    NumberOfCarRow: 4,
    DistanceBetweenCarRow: 52.5,
    StartingCarRowPosition: 361.25, 
    CarWidth: 45,
    CarHeight: 30,
    RiverX: 0,
    RiverY: 50, 
    RiverHeight: 250,
    StartPlanksCount: 6,    
    NumberOfPlankRow: 2,   
    DistanceBetweenPlankRow: 100,   
    StartingPlankRowPosition: 110, 
    PlankWidth: 100,
    PlankHeight: 40,
    StartTime: 0,
    StartingDestinationPosition: 50,
    DestinationCount: 5,
    DestinationWidth: 50,
    DestinationHeight: 5,
    PointsPerDestination: 10,
    GameOverX: 250,
    GameOverY: 330,
    CrocodileCount: 3,
    NumberOfCrocodileRow: 1,
    DistanceBetweenCrocodileRow: 1,
    StartingCrocodilePosition: 160,
    CrocodileWidth: 120,
    CrocodileHeight: 40,
    NumberOfTurtleRow: 1,
    StartingTurtlePosition: 260,
    TurtleCount: 3,
    TurtleWidth: 70,
    TurtleHeight: 40,
    PlankSpeed: -0.5,
    CrocodileSpeed: 1,
    LeftCarSpeed: -0.9,
    RightCarSpeed: 0.7,
    TurtleSpeed: 0.8 
  } as const

  type Rectangle = Readonly<{x: number, y: number, width: number, height:number, fill:string}>
  type ObjectId = Readonly<{id: string, createTime: number}>
  interface IBody extends Rectangle, ObjectId{
    viewType: ViewType,
  }

  //All game objects that are in the game is counted as a Body
  type Body = Readonly<IBody>

  /**
   * A state to keep track of the state of our game. 
   * Modelled after the Model-View-Controller(MVC) architecture shown to us in FRP Asteroids
   */
  type State = Readonly<{
    frog: Body,
    river: Body,
    road: Body,
    cars: ReadonlyArray<Body>,
    planks: ReadonlyArray<Body>,
    crocodile: ReadonlyArray<Body>,
    turtle: ReadonlyArray<Body>,
    destinations: ReadonlyArray<Body>,
    totalDestinationsReached: ReadonlyArray<Body>,
    destinationsLanded: number,
    difficultyMultiplier: number,
    exit: ReadonlyArray<Body>,
    score: number,
    topScore: number,
    wave: number,
    turtleTimer: number,
    turtleUnderwater: boolean,
    timer: number,
    livesRemaining: number
  }>

  /**
   * Function to create a frog
   * @returns Frog body
   */
  function createFrog():Body {
    return {
    viewType: "frog",
    x: Constants.FrogSpawnX,
    y: Constants.FrogSpawnY,
    width: 40,
    height: 40,
    fill: "green",
    id: "frog",
    createTime: Constants.StartTime
    }
  }

  /**
   * Responsible for creating most of the game objects
   * @param viewT Possible view types
   * @param objectId ObjectId type
   * @param rect Rectangle
   * @returns Body object representing details of a game object
   */
  const createRectangle = (viewT: ViewType) => (objectId: ObjectId) => (rect: Rectangle) =>
    <Body>{
      viewType: viewT,
      ...objectId,
      ...rect
    }

    const createCars = createRectangle("car")
    const createPlanks = createRectangle("planks")
    const createDestination = createRectangle("destination")
    const createCrocodile = createRectangle("crocodile")
    const createTurtle = createRectangle("turtle")

    /**
     * A curried function that is responsible for handling the y-coordinates of objects that appear in multiple rows
     * @param rowsNeeded The number of rows needed for that particular type of game object
     * @param distanceBetweenRow The distance between each row
     * @param firstRowCoordinates The y-coordinates of the first row that we want the game object to appear at
     * @param number The nth game object to be processed
     * @returns An integer, denoting the y-coordinates of where that game object should be at
     */
    const manageObjectSpawn = (rowsNeeded: number) => (distanceBetweenRow: number) => (firstRowCoordinates: number) => (num: number) => (num % rowsNeeded) * distanceBetweenRow + firstRowCoordinates

    const spawnCars = manageObjectSpawn(Constants.NumberOfCarRow)(Constants.DistanceBetweenCarRow)(Constants.StartingCarRowPosition)
    const spawnPlanks = manageObjectSpawn(Constants.NumberOfPlankRow)(Constants.DistanceBetweenPlankRow)(Constants.StartingPlankRowPosition)
    
    //Initializing the game objects that can be found in our game 
    //Adapted from FRP Asteroids
    const startCars = [...Array(Constants.StartCarCount)].map((_, i) => createCars({id: "car" + String(i), createTime: Constants.StartTime})({x: (i+1)*65, y: spawnCars(i), width: Constants.CarWidth, height: Constants.CarHeight, fill: "yellow"}))
    const startPlanks = [...Array(Constants.StartPlanksCount)].map((_, i) => createPlanks({id: "plank" + String(i), createTime: Constants.StartTime})({x: (i+1)*90, y: spawnPlanks(i), width: Constants.PlankWidth, height: Constants.PlankHeight, fill: "saddlebrown"}))
    const startDestination = [...Array(Constants.DestinationCount)].map((_, i) => createDestination({id: "destination" + String(i), createTime: Constants.StartTime})({x: i*137.5, y: Constants.StartingDestinationPosition, width: Constants.DestinationWidth, height:Constants.DestinationWidth, fill: "goldenrod"}))
    const startCrocodile = [...Array(Constants.CrocodileCount)].map((_, i) => createCrocodile({id: "crocodile" + String(i), createTime: Constants.StartTime})({x: i*200, y: Constants.StartingCrocodilePosition, width: Constants.CrocodileWidth, height: Constants.CrocodileHeight, fill: "darkolivegreen"}))
    const startTurtle = [...Array(Constants.TurtleCount)].map((_, i) => createTurtle({id: "turtle" + String(i), createTime: Constants.StartTime})({x: i* 250, y: Constants.StartingTurtlePosition, width: Constants.TurtleWidth, height: Constants.TurtleHeight, fill: "chartreuse"}))

  //Initial state of the game 
  const initialState:State = {
    frog: createFrog(),
    river: createRectangle("river")({id: "river", createTime: Constants.StartTime})({x: Constants.RiverX, y: Constants.RiverY, width: Constants.CanvasSize, height: Constants.RiverHeight, fill:"lightseagreen"}),
    road: createRectangle("road")({id: "road", createTime: Constants.StartTime})({x: Constants.RoadX, y: Constants.RoadY, width: Constants.CanvasSize, height: Constants.RoadHeight, fill:"gray"}),
    cars: startCars,
    planks: startPlanks,
    crocodile: startCrocodile,
    turtle: startTurtle,
    destinations: startDestination,
    totalDestinationsReached: [],
    destinationsLanded: 0,
    difficultyMultiplier: 1,
    exit: [],
    score: 0,
    topScore: 0,
    wave: 1,
    turtleTimer: 0,
    turtleUnderwater: false,
    timer: 0,
    livesRemaining: 2
  }

  /**
   * Responsible for handling user's key inputs 
   * Adapted from FRP Asteroids
   * @param k A specific key of either "W", "A", "S", "D" or "R"
   * @param result To transform the KeyboardEvent into object of classes coded above
   * @returns An observable stream of different objects 
   */
  const observeKey = <T>(k:Key, result:()=> T) => 
      fromEvent<KeyboardEvent>(document, "keydown").
      pipe(filter(keyEvent => keyEvent.key === k),
      map(result))

  const moveUp$ = observeKey("w", () => new MoveVertical(-50))
  const moveDown$ = observeKey("s", () => new MoveVertical(50))
  const moveLeft$ = observeKey("a", () => new MoveHorizontal(-20))
  const moveRight$ = observeKey("d", () => new MoveHorizontal(20))
  const restart$ = observeKey("r", () => new Restart())

  /**
   * Function responsible to determine what to process 
   * Adapted from FRP Asteroids
   * @param s Current state
   * @param e Could either be one of the object of classes defined above
   * @returns Different states depending on what e is
   */
  const reduceState = (s: State, e: MoveHorizontal | MoveVertical | Restart | Tick): State => 
    //Do not allow frog to exceed the map voluntarily for x-coords
    e instanceof MoveHorizontal?{...s,
      frog: {...s.frog, x: s.frog.x === 0 && e.position < 0 ? s.frog.x : s.frog.x === 560 && e.position > 0 ? s.frog.x : s.frog.x + e.position}
      //Do not allow frog to exceed the map voluntarily for y-coords
    } : e instanceof MoveVertical ? { ...s, 
      frog: {...s.frog, y: s.frog.y === 0 && e.position < 0 ? s.frog.y : s.frog.y === 560 && e.position > 0 ? s.frog.y : s.frog.y + e.position}
    } : e instanceof Restart ? {...initialState, topScore: s.topScore} : 
    tick(s)


  /**
   * A function to move different game objects around the map
   * @param pos The x coordinates we want the game object to be moved by
   * @param gameObject The game object that we plan to move around the map
   * @returns A new game object body with the new x-coordinates
   */
  function moveGameObject(pos: number, gameObject: Body): Body{
    return{
      ...gameObject,
      //The new x coordinates of the game object is checked whether it exits the map size to allow wrapping from the other side
      x: (gameObject.x + pos) > Constants.CanvasSize ? -115 : (gameObject.x + pos) < -116 ? 600 : (gameObject.x + pos) 
    }
  }

  /**
   * A curried function to detect collision between two rectangles 
   * Taken from https://stackoverflow.com/questions/31022269/collision-detection-between-two-rectangles-in-java
   * @param a The first game object to check collision with 
   * @param widthAdjustment Used to determine how many percent of the width of the second game object we want to collide with
   * @param heightAdjustment Used to determine how many percent of the height of the second game object we want to collide with 
   * @param b The second game object to check collision with
   * @returns A boolean representing true if there is a collision, false otherwise
   */
  const collisionDetection = (a: Body) => (widthAdjustment: number) => (heightAdjustment: number) => (b:Body) => {
          return b.x + b.width*(widthAdjustment) > a.x && 
                 b.y + b.height*(heightAdjustment) > a.y &&
                 a.x + a.width > b.x && 
                 a.y + a.height > b.y
  }
   
  /**
   * Tick function responsible for handling the passage of time
   * Adapted from FRP Asteroids
   * @param s The current state to be updated every 10 miliseconds
   * @returns The new state after handling most of what the game objects should do, or just the constant same state if there are no lies remaining
   */
  const tick = (s:State):State => {
    //All cars on the odd-numbered row will be moving left
    const leftMovingCars = s.cars.filter(obj => Number(obj.id.charAt(obj.id.length-1)) % 2 === 1).map<Body>(car => moveGameObject(Constants.LeftCarSpeed*s.difficultyMultiplier, car))
    //All cars on the even-numbered row will be moving right
    const rightMovingCars = s.cars.filter(obj => Number(obj.id.charAt(obj.id.length-1)) % 2 === 0).map<Body>(car => moveGameObject(Constants.RightCarSpeed*s.difficultyMultiplier, car))
    
    const processPlank = s.planks.map<Body>(plank => moveGameObject(Constants.PlankSpeed*s.difficultyMultiplier, plank))
    const processCrocodile = s.crocodile.map<Body>(crocodile => moveGameObject(Constants.CrocodileSpeed*s.difficultyMultiplier, crocodile))

    //Calculating the turtle colours based on whether it is good, it is going to go underwater, or it is already underwater
    const correctTurtleColour = s.turtleTimer >= 5 && s.turtleTimer < 7 ? "darkred" : s.turtleTimer >= 3 && s.turtleTimer < 5 ? "darkkhaki" : "chartreuse"
    //Process movement of turtles and also give them the correct colour
    const processTurtle = s.turtle.map<Body>(turtle => moveGameObject(Constants.TurtleSpeed*s.difficultyMultiplier, turtle)).map(turtle => turtle = {...turtle, fill: correctTurtleColour})

    //If there are still lives remaining, return the new state to be checked for collisions between frog and other game objects. Else, just return the same state
    return s.livesRemaining === 0 ? s : handlingCollision({
      ...s,
      //Sort cars based on their ID
      cars: leftMovingCars.concat(rightMovingCars).sort((car1, car2) => Number(car1.id) - Number(car2.id)),
      planks: processPlank,
      crocodile: processCrocodile,
      turtle: processTurtle,
      turtleTimer: (s.turtleTimer + 0.01) % 7,
      timer: s.timer + 0.01,
      turtleUnderwater: s.turtleTimer >= 5 && s.turtleTimer < 7 ? true : false
    })
  }

  /**
   * Function to check a state for collisions
   * Adapted from FRP Asteroids
   * @param s The state to check for collisions
   * @returns The new state after processing all collisions
   */
  const handlingCollision = (s: State):State => {
    const frogCollision = collisionDetection(s.frog)(1)(1)
    //Collision with cars
    const frogCarCollision = s.cars.filter(car => frogCollision(car))
    //Collision with river
    const frogRiverCollision = frogCollision(s.river)
    //Collision with planks
    const frogPlankCollision = s.planks.filter(planks => frogCollision(planks))

    //Collision with destinations
    const frogDestinationCollision = s.destinations.filter(destinations => frogCollision(destinations))
    //Contains array of every destination except that the one the frog just collided with
    const remainingDestination = except((a: Body) => (b: Body) => a.id === b.id)(s.destinations)(frogDestinationCollision)

    //Colliision with crocodiles, with width of crocodiles adjusted to make sure frog dies when it reaches the mouth because the frog won't be colliding with the crocodile when it reaches the mouth after adjustment
    const frogCrocodileCollision = s.crocodile.filter(crocodile => collisionDetection(s.frog)(11/20)(1)(crocodile))
    //Collision with turtles
    const frogTurtleCollision = s.turtle.filter(turtle => frogCollision(turtle))

                              
    const gameOverConditions = frogCarCollision.length > 0 || 
                              //If frog goes out of bounds towards the right of the map
                               s.frog.x > Constants.CanvasSize + 60 || 
                              //If frog goes out of bounds to wards the left of the map
                               s.frog.x < -60 || 
                               //If frog is in the river and is touching nothing else
                               frogRiverCollision && frogDestinationCollision.length > 0 === false && frogPlankCollision.length > 0 === false && frogCrocodileCollision.length > 0 === false && frogTurtleCollision.length > 0 === false ||
                               //If frog is in the river and on a turtle but it is underwater
                               frogRiverCollision && frogTurtleCollision.length > 0 === true && s.turtleUnderwater === true || 
                               //Too much time spent in current wave resulting in death of frog
                               s.timer >= 60
                               
    //This is to process the illusion of frog moving "on" the river objects
    const frogMovementOnObjects = frogPlankCollision.length > 0 ? s.frog.x + Constants.PlankSpeed*s.difficultyMultiplier : 
                                  frogCrocodileCollision.length > 0 ? s.frog.x + Constants.CrocodileSpeed*s.difficultyMultiplier : 
                                  frogTurtleCollision.length > 0 ? s.frog.x + Constants.TurtleSpeed*s.difficultyMultiplier : s.frog.x

    //If frog loses a life or touches a destination, it goes back to spawn                    
    const adjustFrogXPosition = frogDestinationCollision.length === 1 || gameOverConditions ? Constants.FrogSpawnX : frogMovementOnObjects
    const adjustFrogYPosition = frogDestinationCollision.length === 1 || gameOverConditions ? Constants.FrogSpawnY : s.frog.y

    //Total amount of destinations reached
    const totalDestinationsAmount = frogDestinationCollision.length === 1 ? s.destinationsLanded + 1 : s.destinationsLanded
    //Process the points gotten so far. The higher the wave, the more points obtainable from reaching destinations
    const newPointsAmount = frogDestinationCollision.length === 1 ? s.score + Constants.PointsPerDestination*s.wave : s.score
    //If current score higher than top score then update the top score
    const newTopScoreAmount = newPointsAmount > s.topScore ? newPointsAmount : s.topScore

    //This means that this wave is completed, so process next wave 
    return totalDestinationsAmount === Constants.DestinationCount ? 
    <State>
    {...initialState, 
      difficultyMultiplier: s.difficultyMultiplier + 0.5, 
      wave: s.wave + 1, 
      topScore: newTopScoreAmount, 
      score: newPointsAmount,
      cars: s.cars,
      planks: s.planks,
      crocodile: s.crocodile,
      turtle: s.turtle} : 

    //Wave is still in progress
    <State>{
      ...s,
      frog: {...s.frog, x: adjustFrogXPosition, y: adjustFrogYPosition},
      destinations: remainingDestination,
      totalDestinationsReached: s.totalDestinationsReached.concat(frogDestinationCollision.map((destination) => destination = {...destination, fill: "firebrick", id: "reached" + String(s.destinationsLanded)})),
      destinationsLanded: totalDestinationsAmount,
      //We want to remove the svg of the destination frog has collided with so we add it to the exit array
      exit: s.exit.concat(frogDestinationCollision),
      score: newPointsAmount,
      topScore: newTopScoreAmount,
      //If timer has reached 60 seconds, revert it back to 0 at the cost of a life
      timer: s.timer >= 60 ? 0 : s.timer,
      livesRemaining: gameOverConditions ? s.livesRemaining - 1 : s.livesRemaining
    }
  }

  //Game clock using discrete timesteps of 10 miliseconds
  const gameClock$ = interval(10).pipe(map(elapsed => new Tick(elapsed)))
  //Essentially our entire game
  const gameInProgress = merge(gameClock$, moveUp$, moveDown$, moveLeft$, moveRight$, restart$).
                         pipe(scan(reduceState, initialState)).
                         subscribe(updateView)

  /**
   * Function used to update the svg's on the HTML page based on the current state
   * Adapted from FRP Asteroids
   * @param s Current state to update HTML page on 
   */
  function updateView(s:State){
    /**
      * Function to create svg of the game objects based on it's state
      * @returns Svg object modelled after game object's state
      */
    const updateBodyView = (b:Body) => {
      function createBodyView(){
        const v = document.createElementNS(svg.namespaceURI, "rect")
        v.setAttribute("id", b.id)
        v.setAttribute("width", String(b.width))
        v.setAttribute("height", String(b.height))
        svg.appendChild(v)
        return v;
      }
      const v = document.getElementById(b.id) || createBodyView()
      v.setAttribute("x", String(b.x))
      v.setAttribute("y", String(b.y))
      v.setAttribute("fill", b.fill)
    }

    //To update information that the players would like to know
    const score = document.getElementById("Score")!
    const highsScore = document.getElementById("High Score")!
    const wave = document.getElementById("Wave")!
    const timer = document.getElementById("Time")!
    const lives = document.getElementById("Lives")!
    const timeLeft = 60 - s.timer > 0 ? 60 - s.timer : 0.00
    score.textContent = "Score: " + String(s.score) 
    highsScore.textContent = "High Score: " + String(s.topScore)
    wave.textContent = "Wave " + String(s.wave)
    timer.textContent = "Time remaining: " + String(timeLeft.toFixed(2))
    lives.textContent = "Lives: " + String(s.livesRemaining)

    if(s.livesRemaining === 0){
      //Make game over text if no lives remaining
      if (document.getElementById("gameOverText") === null){
      const v = document.createElementNS(svg.namespaceURI, "text")
      v.setAttribute("x", String(Constants.GameOverX))
      v.setAttribute("y", String(Constants.GameOverY))
      v.setAttribute("id", "gameOverText")
      v.setAttribute("fill", "white")
      v.setAttribute("font-size", "20")
      v.textContent = "Game Over!"
      svg.appendChild(v)
      }
    }
    else{
      //Remove the game over text when player decides to restart 
      if(document.getElementById("gameOverText") != null){
      svg.removeChild(document.getElementById("gameOverText")!)
      }
      //Update all game objects on the HTML page
      updateBodyView(s.road)
      updateBodyView(s.river)
      s.cars.forEach(updateBodyView)
      s.planks.forEach(updateBodyView)
      s.crocodile.forEach(updateBodyView)
      s.turtle.forEach(updateBodyView)
      s.destinations.forEach(updateBodyView)
      s.totalDestinationsReached.forEach(updateBodyView)
      //Remove all the unwanted svg elements on the HTML page
      s.exit.map(object => document.getElementById(object.id)).filter(isNotNullOrUndefined).forEach(v => svg.removeChild(v))
      updateBodyView(s.frog);
    }
}

//Helper functions adapted from FRP Asteroids
/**
 * Composable not: invert boolean result of given function
 * @param f a function returning boolean
 * @param x the value that will be tested with f
 */
const not = <T>(f:(x:T)=>boolean)=> (x:T)=> !f(x)

/**
 * is e an element of a using the eq function to test equality?
 * @param eq equality test function for two Ts
 * @param a an array that will be searched
 * @param e an element to search a for
 */
const except = <T>(eq: (_:T) => (_:T) => boolean) => (a:ReadonlyArray<T>) => (b:ReadonlyArray<T>) => a.filter(not(elem(eq)(b)))

/**
 * array a except anything in b
 * @param eq equality test function for two Ts
 * @param a array to be filtered
 * @param b array of elements to be filtered out of a
 */ 
const elem = <T>(eq: (_:T) => (_:T) => boolean) => (a:ReadonlyArray<T>)=> (e:T) => a.findIndex(eq(e)) >= 0

/**
 * Type guard for use in filters
 * @param input something that might be null or undefined
 */
function isNotNullOrUndefined<T extends Object>(input: null | undefined | T): input is T {
  return input != null;
}

}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}