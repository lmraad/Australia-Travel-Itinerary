//Gets around the self-signed certificate error of school network that prevents calls to APIs working
process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = 0

//To access environment variables
require("dotenv").config()

//import the packages
const express = require('express')
const { engine } = require('express-handlebars')
const sqlite = require('sqlite-sync')
const fs = require('fs')
const path = require('path')
const fetch = require('sync-fetch')
const db = require("siennasql")

const jsonp = require("then-jsonp")
const jxon = require("jxon")
const bcrypt = require('bcrypt')
const CryptoJS = require("crypto-js")

const session = require('express-session')
const { info } = require('console')
const { request } = require('http')

//create the server
const app = express()

//connect to the database
db.connect("travel.db")

//setup the server to work the way we want
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.engine(".hbs", engine({ extname: ".hbs" }))
app.set("view engine", ".hbs")
app.use(
    session(
        {
            //secret is for encryption
            secret: "penguin",
            resave: false,
            saveUninitialized: true,
            //cookies allow the system to remember users when they come back
            cookie: {
                //maxAge is the expiry date, how long the user will stay logged in for
                //If it isn't specified, the cookie will never expire and last forever
                //60000 is 1 minute (milliseconds)
                maxAge: 60000 * 30
            }
        }
    )
)

//turn on the server
app.listen(3000, function () { console.log('running on port 3000') })

//defining global variables
const saltRounds = 10

app.all( //login
    '/',
    function (request, response) {
        response.render("login.hbs")
    }
)

function isLoggedIn(userID) {
    if (userID !== undefined) {
        return true
    } else {
        return false
    }
}

async function renderItineraryOrPastTrips(request, response, userID, hbsFile) {
    //Checking if the user is currently logged in
    let loggedIn = isLoggedIn(request.session.userID)
    if (loggedIn === false) {
        response.render("login.hbs")
        return
    }

    //Retrieving user data from TRIPS, depending on whether they are viewing itinerary or past trips
    let list
    if (hbsFile === "itinerary.hbs") {
        list = db.run("SELECT ID, DATE, PLACE_ID FROM TRIPS WHERE COMPLETED='N' AND USER_ID=?", [userID])
    } else if (hbsFile === "pastTrips.hbs") {
        list = db.run("SELECT ID, DATE, PLACE_ID FROM TRIPS WHERE COMPLETED='Y' AND USER_ID=?", [userID])
    }
    
    //If the user has no saved locations in the selected list
    if (list.length === 0) {
        let nothingMessage = "No locations saved yet."
        response.render(hbsFile, {nothingMessage})
        return
    } else {
        let listItems = []
        //Gathering each saved story's information
        for (let i=0; i<list.length; i++) {
            //storyInfo is an array containing:
            //[0] an object with Place, State, Title, Date published, Primary image caption, URL, and MediaRSS URL
            //[1] the link to the thumbnail image
            //[2] an array with the audio links
            let storyInfo = await retrieveStory(list[i].PLACE_ID)

            //Decrypting the date
            let bytes = CryptoJS.AES.decrypt(list[i].DATE, process.env.KEY)
            let date = bytes.toString(CryptoJS.enc.Utf8) //formatted YYYY-MM-DD

            //Formatting the date (because the Australian one should be displayed)
            let AmericanDate = new Date(date)

            let day
            if (AmericanDate.getDate() < 10) {
                day = "0"+ AmericanDate.getDate()
            } else {
                day = AmericanDate.getDate()
            }

            let month
            if (AmericanDate.getMonth() < 10) {
                month = "0"+ (AmericanDate.getMonth() + 1)
            } else {
                month = AmericanDate.getMonth() + 1
            }

            let AussieDate = day +" / "+ month +" / "+ AmericanDate.getFullYear()

            //Defining the object which will be sent to the client to be displayed
            //DATE is for the value of the change date input, which has to be of the
            //certain format, and AU_DATE is for displaying to the user
            let object = {
                ID: list[i].ID,
                DATE: date,
                AU_DATE: AussieDate,
                PLACE: storyInfo[0]["Place"],
                STATE: storyInfo[0]["State"],
                DATE_PUBLISHED: storyInfo[0]["Date"],
                TITLE: storyInfo[0]["Title"],
                THUMBNAIL: storyInfo[1],
                DESCRIPTION: storyInfo[0]["Primary image caption"],
                URL: storyInfo[0]["URL"],
                AUDIO: storyInfo[2][0] //Only the first audio link is sent through
            }

            listItems.push(object)
        }

        //Sorting the list by date
        if (hbsFile === "itinerary.hbs") {
            listItems.sort(function(a,b){
                //Turns the strings into dates, and subtracts them to return a
                //value that is negative, positive, or zero
                //This sorts them from earliest to latest:
                return new Date(a.DATE) - new Date(b.DATE)
            })
        } else if (hbsFile === "pastTrips.hbs") {
            listItems.sort(function(a,b){
                //This sorts them from latest to earliest:
                return new Date(b.DATE) - new Date(a.DATE)
            })
        }

        response.render(hbsFile, {listItems: listItems})
    }
}

app.all( //processLogin
    '/processLogin',
    function (request, response) {

        let username = request.body.username
        let password = request.body.password

        let info = db.run("SELECT ID, PASSWORD FROM USERS WHERE USERNAME=?", [username])
        
        //If there is an account with the entered username
        if (info.length !== 0) { //AVOIDS POSSIBLE ERRORS
            bcrypt.compare(password, info[0].PASSWORD, function(err, result) {

                //If the entered password matches the hash in the database
                if (result === true) {
                    request.session.userID = info[0].ID //Defining the session userID
                    renderItineraryOrPastTrips(request, response, request.session.userID, "itinerary.hbs")
                } else {
                    let error = "Invalid credentials."
                    response.render("login.hbs", {error})
                }

            })
        } else {
            let error = "Invalid credentials."
            response.render("login.hbs", {error})
        }
    }
)

app.all( //processSignUp
    '/processSignUp',
    function (request, response) {

        let username = request.body.username
        let password = request.body.password

        //Testing whether username is already taken
        let existing = db.run("SELECT ID FROM USERS WHERE USERNAME=?", [username])
        if (existing.length > 0) {
            let error = "Username already exists."
            response.render("login.hbs", {error})
            return
        }

        //If submitted info is not empty SECURITY BC ENSURING SOMEWHAT SECURE PASSWORD
        if (username.length > 0 && password.length > 0) {
            bcrypt.hash(password, saltRounds, function(err, hash) {
                db.run("INSERT INTO USERS (USERNAME, PASSWORD) VALUES (?,?)", [username, hash])

                let userID = db.run("SELECT ID FROM USERS WHERE USERNAME=? AND PASSWORD=?", [username, hash])
                request.session.userID = userID[0].ID //Defining the session userID
                renderItineraryOrPastTrips(request, response, request.session.userID, "itinerary.hbs")
            })
        } else {
            let error = "Invalid information."
            response.render("login.hbs", {error})
        }
    }
)

async function retrieveStory (placeID) {
    //Retrieving the story's info from the API
    let url = `https://data.gov.au/data/api/3/action/datastore_search_sql?sql=SELECT "Place", "State", "Title", "Date", "Primary image caption", "URL", "MediaRSS URL" from "d73f2a2a-c271-4edd-ac45-25fd7ad2241f" WHERE "_id"=`+placeID
    let result = await jsonp('GET', url)
    let storyInfo = result.result.records

    //Converting XML data to JSON
    let xmlData = fetch(result.result.records[0]['MediaRSS URL']).text()
    let xmlObject = jxon.stringToJs(xmlData)

    //Finding the thumbnail image
    //Below is because some stories contain an array of items, while others just
    //have a single item not in an array
    let thumbnail
    if (Array.isArray(xmlObject.rss.channel.item) === true) {
        thumbnail = xmlObject.rss.channel.item[0]['media:thumbnail']['$url']
    } else {
        thumbnail = xmlObject.rss.channel.item['media:thumbnail']['$url']
    }
    storyInfo.push(thumbnail)

    //Finding the audio links
    let audio = []
    //Looping through each of the story's "items"...
    for (let i=0; i<xmlObject.rss.channel.item.length; i++) {

        //If there is media content that isn't located in a media group...
        if (xmlObject.rss.channel.item[i]['media:content'] !== undefined) {
            if (xmlObject.rss.channel.item[i]['media:content']['$type'].includes("audio") === true) {
                audio.push(xmlObject.rss.channel.item[i]['media:content']['$url'])
            }
        }

    }

    storyInfo.push(audio)
    return storyInfo
}

app.all( //removeLocation
    '/removeLocation',
    function (request, response) {

        //Deleting the story from itinerary or past trips
        let id = request.body.tripID
        db.run("DELETE FROM TRIPS WHERE ID=?", [id])

        //Rendering itinerary or past trips again
        let listType = request.body.listType
        if (listType === "itinerary") {
            renderItineraryOrPastTrips(request, response, request.session.userID, "itinerary.hbs")
        } else if (listType === "pastTrips") {
            renderItineraryOrPastTrips(request, response, request.session.userID, "pastTrips.hbs")
        }
    }
)

app.all( //changeDate
    '/changeDate',
    function (request, response) {

        let id = request.body.tripID
        let date = request.body.date //Formatted like YYYY-MM-DD

        //Encrypting the date
        let encryptedDate = CryptoJS.AES.encrypt(date, process.env.KEY).toString()

        //Updating the date in TRIPS
        db.run("UPDATE TRIPS SET DATE=? WHERE ID=?", [encryptedDate, id])

        //Rendering itinerary or past trips again
        let listType = request.body.listType
        if (listType === "itinerary") {
            renderItineraryOrPastTrips(request, response, request.session.userID, "itinerary.hbs")
        } else if (listType === "pastTrips") {
            renderItineraryOrPastTrips(request, response, request.session.userID, "pastTrips.hbs")
        }
    }
)

app.all( //logOut
    '/logOut',
    function (request, response) {
        request.session.userID = undefined
        response.render("login.hbs")
    }
)

app.all( //itinerary
    '/itinerary',
    function (request, response) {
        renderItineraryOrPastTrips(request, response, request.session.userID, "itinerary.hbs")
    }
)

app.all( //pastTrips
    '/pastTrips',
    function (request, response) {
        renderItineraryOrPastTrips(request, response, request.session.userID, "pastTrips.hbs")
    }
)

app.all( //map
    '/map',
    async function (request, response) {

        //Checking if the user is currently logged in
        let loggedIn = isLoggedIn(request.session.userID)
        if (loggedIn === false) {
            response.render("login.hbs")
            return
        }

        //Retrieving required information
        let userID = request.session.userID
        let url = `https://data.gov.au/data/api/3/action/datastore_search_sql?sql=SELECT "_id", "Longitude", "Latitude", "Title", "Place", "State" from "d73f2a2a-c271-4edd-ac45-25fd7ad2241f"`
        let data = await jsonp('GET', url)

        let lon = []
        let lat = []
        let titles = []
        let colours = []
        let places = []

        //Looping through each story...
        for (let i=0; i<data.result.records.length; i++) {
            
            let id = data.result.records[i]['_id'] //The story's ID
            
            //Below array is like: [ {COMPLETED: 'Y'}, {COMPLETED: 'N'} ] for each location
            let userCompleted = db.run("SELECT COMPLETED FROM TRIPS WHERE PLACE_ID=? AND USER_ID=?", [id, userID])

            //If the story is in one of the lists
            if (userCompleted.length > 0) {

                let pastTrip = true
                for (let j=0; j<userCompleted.length; j++) {
                    //If the story is in the itinerary at all
                    if (userCompleted[j].COMPLETED === "N") {
                        colours.push("'"+"#f71b61"+"'") //itinerary colour
                        pastTrip = false
                    }
                }

                //If the story is in the past trips list
                if (pastTrip === true) {
                    colours.push("'"+"#33a351"+"'") //past trips colour
                }
            
            //If the story isn't saved by the user at all
            } else {
                colours.push("'"+"#2159ff"+"'") //other places colour
            }

            lon.push(data.result.records[i]['Longitude'])
            lat.push(data.result.records[i]['Latitude'])
            titles.push(`<a style="color: white;" target="_self" href="/searchResults?id=${id}">${data.result.records[i]['Title']}</a>`)

            //Defining the search input's list of acceptable values
            let location = {PLACE: data.result.records[i]['Place'] +", "+ data.result.records[i]['State']}
            if (places.includes(location) === false) {
                places.push(location)
            }
        }

        let centreLon = 133.534693
        let centreLat = -25.641526
        let centreZoom = 2.6

        response.render("map.hbs", {
            colours: colours,
            lon: lon,
            lat: lat,
            titles: JSON.stringify(titles),
            centreLon: centreLon,
            centreLat: centreLat,
            centreZoom: centreZoom,
            places: places
        })

    }
)

app.all( //searchResults
    '/searchResults',
    async function (request, response) {

        //Checking if the user is currently logged in
        let loggedIn = isLoggedIn(request.session.userID)
        if (loggedIn === false) {
            response.render("login.hbs")
            return
        }

        //locationSearch is the text that will be displayed at the top of
        //the results page (of the form: Place, State)
        let locationSearch
        let results = []

        //Getting each result story's ID
        //If a specific location on the map was selected...
        if (request.query.id) {
            //The object below is pushed into the array so that retrieveStory can
            //be run later to get the story's information (this function needs the story's ID)
            results.push({"_id": request.query.id})

            //Getting the selected point's Place and State to define locationSearch
            let url = `https://data.gov.au/data/api/3/action/datastore_search_sql?sql=SELECT "Place", "State" from "d73f2a2a-c271-4edd-ac45-25fd7ad2241f" WHERE "_id"=`+request.query.id
            let result = await jsonp('GET', url)
            locationSearch = result.result.records[0]["Place"] +", "+ result.result.records[0]["State"]
    
        //If the user made a search
        } else {
            locationSearch = request.body.locationSearch //From user's search input
            let placeAndState = locationSearch.split(", ") //Splitting into [Place, State]

            //Conducting the search by requesting searched data from the API
            let url = `https://data.gov.au/data/api/3/action/datastore_search_sql?sql=SELECT "_id" from "d73f2a2a-c271-4edd-ac45-25fd7ad2241f" WHERE "Place"='${placeAndState[0]}' AND "State"='${placeAndState[1]}'`
            let result = await jsonp('GET', url)
            results = result.result.records
        }

        //If there are no results for the search
        if (results.length <= 0) {
            let nothingMessage = "No results."
            response.render("searchResults.hbs", {locationSearch: locationSearch, nothingMessage: nothingMessage})
            return
        }

        //Getting each result story's information
        let resultItems = []
        for (let i=0; i<results.length; i++) { //Looping through each result story...
            //storyInfo is an array containing:
            //[0] an object with Place, State, Title, Date published, Primary image caption, URL, and MediaRSS URL
            //[1] the link to the thumbnail image
            //[2] an array with the audio links
            let storyInfo = await retrieveStory(results[i]["_id"])

            //Defining the object which will be sent to the client to be displayed
            let object = {
                ID: results[i]["_id"],
                PLACE: storyInfo[0]["Place"],
                STATE: storyInfo[0]["State"],
                DATE_PUBLISHED: storyInfo[0]["Date"],
                TITLE: storyInfo[0]["Title"],
                THUMBNAIL: storyInfo[1],
                DESCRIPTION: storyInfo[0]["Primary image caption"],
                URL: storyInfo[0]["URL"],
                AUDIO: storyInfo[2][0] //Only first audio link being sent through
            }

            resultItems.push(object)
        }

        response.render("searchResults.hbs", {resultItems: resultItems, locationSearch: locationSearch})
    }
)

app.all( //addTo
    '/addTo',
    function (request, response) {

        //Defining the userID, placeID, and completed values
        let userID = request.session.userID
        let locationID = request.body.locationID
        let completed = request.body.completed

        //Getting the current date and formatting it as YYYY-MM-DD to be stored
        let date = new Date() //The current date

        let day
        if (date.getDate() < 10) {
            day = "0"+ date.getDate()
        } else {
            day = date.getDate()
        }

        let month
        if (date.getMonth() < 10) {
            month = "0"+ (date.getMonth() + 1)
        } else {
            month = date.getMonth() + 1
        }

        date = date.getFullYear() +"-"+ month +"-"+ day //Now formatted YYYY-MM-DD

        //Encrypting the date
        let encryptedDate = CryptoJS.AES.encrypt(date, process.env.KEY).toString()

        //Inserting the new saved location in TRIPS
        db.run("INSERT INTO TRIPS(USER_ID, PLACE_ID, COMPLETED, DATE) VALUES (?,?,?,?)", [userID, locationID, completed, encryptedDate])
    
        //Rendering itinerary or past trips (based on which was added to)
        if (completed === "N") {
            renderItineraryOrPastTrips(request, response, request.session.userID, "itinerary.hbs")
            return
        } else {
            renderItineraryOrPastTrips(request, response, request.session.userID, "pastTrips.hbs")
            return
        }
    }
)