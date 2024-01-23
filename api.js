let jsonp = require("then-jsonp")
const fetch = require("sync-fetch")
const jxon = require("jxon")
const fs = require('fs')

const db = require('sqlite-sync')
db.connect('travel.db')

//let url = "https://data.gov.au/data/api/3/action/datastore_search?resource_id=d73f2a2a-c271-4edd-ac45-25fd7ad2241f&limit=5"
//NOTE: "State" needs double quotes around it
//let url = `https://data.gov.au/data/api/3/action/datastore_search_sql?sql=SELECT * from "d73f2a2a-c271-4edd-ac45-25fd7ad2241f" WHERE "State" LIKE 'NSW'`
let url = `https://data.gov.au/data/api/3/action/datastore_search_sql?sql=SELECT "Place", "State", "Title", "Date", "Primary image caption", "URL", "MediaRSS URL" from "d73f2a2a-c271-4edd-ac45-25fd7ad2241f" WHERE "_id"=33`
//let url = `https://data.gov.au/data/api/3/action/datastore_search_sql?sql=SELECT "_id", "Longitude", "Latitude" from "d73f2a2a-c271-4edd-ac45-25fd7ad2241f"`

let result = jsonp(
    'GET',
    url
)

result.done(
    function (data) {
        console.log(data.result.records[0])

        //someData is representing data.result.records
        // let someData = [data.result.records[0], data.result.records[1], data.result.records[2], data.result.records[3], data.result.records[4]]

        // let lon = []
        // let lat = []
        // let colours = []
        // for (let i=0; i<someData.length; i++) {
        //     let id = someData[i]['_id']
            
        //     //Below array is like:
        //     //[ {COMPLETED: 'Y'}, {COMPLETED: 'N'} ] for each location
        //     let userCompleted = db.run("SELECT COMPLETED FROM TRIPS WHERE PLACE_ID = ? AND USER_ID = ?", [id,1])
        //     console.log(userCompleted)
        //     console.log(someData[i])

        //     //if the story is in one of the lists...
        //     if (userCompleted.length > 0) {
        //         let pastTrip = true
        //         for (let j=0; j<userCompleted.length; j++) {
        //             //if the story is in the itinerary...
        //             if (userCompleted[j].COMPLETED === 'N') {
        //                 colours.push("(itinerary colour)")
        //                 pastTrip = false
        //             }
        //         }
        //         //if the story is in the past trips list...
        //         if (pastTrip === true) {
        //             colours.push("(past trips colour)")
        //         }
        //     //if the story isn't saved by the user...
        //     } else {
        //         colours.push("(other places colour)")
        //     }

        //     lon.push(someData[i]['Longitude'])
        //     lat.push(someData[i]['Latitude'])
        // }
        // console.log(lon)
        // console.log(lat)
        // console.log(colours)

        /*
        let someData = [data.result.records[0], data.result.records[1], data.result.records[2], data.result.records[3], data.result.records[4]]

        let itineraryLon = []
        let itineraryLat = []
        let pastTripsLon = []
        let pastTripsLat = []
        let otherPlacesLon = []
        let otherPlacesLat = []
        for (let i=0; i<someData.length; i++) {
            let id = someData[i]['_id']
            
            //Below array is like:
            //[ {COMPLETED: 'Y'}, {COMPLETED: 'N'} ] for each location
            let userCompleted = db.run("SELECT COMPLETED FROM TRIPS WHERE PLACE_ID = ? AND USER_ID = ?", [id,1])
            console.log(userCompleted)
            console.log(someData[i])

            //if the story is in one of the lists...
            if (userCompleted.length > 0) {
                let pastTrip = true
                for (let j=0; j<userCompleted.length; j++) {
                    //if the story is in the itinerary...
                    if (userCompleted[j].COMPLETED === 'N') {
                        itineraryLon.push(someData[i]['Longitude'])
                        itineraryLat.push(someData[i]['Latitude'])
                        pastTrip = false
                    }
                }
                //if the story is in the past trips list...
                if (pastTrip === true) {
                    pastTripsLon.push(someData[i]['Longitude'])
                    pastTripsLat.push(someData[i]['Latitude'])
                }
            //if the story isn't saved by the user...
            } else {
                otherPlacesLon.push(someData[i]['Longitude'])
                otherPlacesLat.push(someData[i]['Latitude'])
            }
        }
        console.log(itineraryLon)
        console.log(itineraryLat)
        console.log(pastTripsLon)
        console.log(pastTripsLat)
        console.log(otherPlacesLon)
        console.log(otherPlacesLat)
        */
        
        // let jsonContent = JSON.stringify(data)
        // //console.log(jsonContent)
        
        // fs.writeFile("beautify.json", jsonContent, 'utf8', function (err) {
        //     if (err) {
        //         console.log("An error occured while writing JSON Object to File.")
        //         return console.log(err)
        //     }
        
        //     console.log("JSON file has been saved.")
        // })

        // for (let i=0; i<200; i++) {
        //     let xmlData = fetch(data.result.records[i]['MediaRSS URL']).text()
        //     let xmlObject = jxon.stringToJs(xmlData)

        //     console.log(xmlObject)
        // }

        // //CONVERTING XML TO JSON
        // let xmlData = fetch(data.result.records[0]['MediaRSS URL']).text()
        // let xmlObject = jxon.stringToJs(xmlData)

        // //FINDING THUMBNAIL IMAGE
        // console.log(xmlObject.rss.channel.item[0]['media:thumbnail']['$url'])

        // //FINDING AUDIO
        // for (let i=0; i<xmlObject.rss.channel.item.length; i++) {

        //     //console.log(xmlObject.rss.channel.item[i]['media:group']['media:content'])

        //     if (xmlObject.rss.channel.item[i]['media:content'] !== undefined) {
        //         if (xmlObject.rss.channel.item[i]['media:content']['$type'].includes("audio") === true) {
        //             console.log(xmlObject.rss.channel.item[i]['media:content']['$url'])
        //         }
        //     }

        // }

        // fs.writeFile("beautify.xml", xmlData, 'utf8', function (err) {
        //     if (err) {
        //         console.log("An error occured while writing xml to File.")
        //         return console.log(err)
        //     }
        
        //     console.log("xml file has been saved.")
        // })

        //console.log(xmlData)
    }
)