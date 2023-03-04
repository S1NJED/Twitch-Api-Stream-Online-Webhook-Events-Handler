const express = require('express');
const app = express();
const PORT = 3000;

// TWITCH IMPORTS
const {
    getCredentials,
    getEvents,
    getUserById,
    getUserByUsername,
    TWITCH_CLIENT_ID,
    CREDENTIALS,
    event_cache_

} = require('./functions/twitch');
let event_cache = event_cache_;

app.get('/twitch', (req, res) => {
    console.log(req.headers['x-forwarded-for'] + " | " + req.method, req.path); const clientIpAddress = req.headers['x-forwarded-for']; const method = req.method; const endpoint = req.path; abuseIpCheck(clientIpAddress, method, endpoint);
    
    const response = res;
    const state = generateState();
    const url = req.headers['referer'] + "/twitch/get_events" + `?state=${state}`;
    
    if ( isEmpty(event_cache) ) { // empty
        console.log('is empty');
        fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/html'
            }
        })
            .then((res) => {return res.text()})
            .then((data) => {
                response.status(200).send(data);
            })
    }
    else { // event_cache NOT EMPTY
        console.log("event_cache not empty");
        res.status(200).render('twitch', event_cache);
    }

    fs.readFile(path.join(__dirname, 'cache', 'EVENTS.json'), (err, data) => {
        event_cache = JSON.parse(data);
    });

});

app.get("/twitch/get_events", (req, res) => {
    console.log(req.headers['x-forwarded-for'] + " | " + req.method, req.path); const clientIpAddress = req.headers['x-forwarded-for']; const method = req.method; const endpoint = req.path; abuseIpCheck(clientIpAddress, method, endpoint);
    
    if (!req.cookies['WEB_AUTH_TOKEN']) { return res.redirect("/auth?redirect=/twitch/get_events"); } // CHECKING IF COOKIES TO SEE AUTHENTICATION

    const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
    const token = CREDENTIALS['access_token'];
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Client-id': TWITCH_CLIENT_ID
    };
    
    getEvents(res, url, 'GET', headers); // response.status() .. inside the func

})


let eventNotifState = true;
app.get('/twitch/add_event', (req, res) => { // when post redirect to origin
    console.log(req.headers['x-forwarded-for'] + " | " + req.method, req.path); const clientIpAddress = req.headers['x-forwarded-for']; const method = req.method; const endpoint = req.path; abuseIpCheck(clientIpAddress, method, endpoint);
    const streamer_username = req.query['queryParam'] || null;
    if (!streamer_username) { return res.status(400).send({"error": "No streamer username provided", status: 400}) } // No query params

    if (!req.cookies['WEB_AUTH_TOKEN']) { return res.redirect("auth?redirect=/twitch/add_event&queryParam=" + streamer_username) } // CHECKING IF COOKIES TO SEE AUTHENTICATION

    const url = "https://api.twitch.tv/helix/eventsub/subscriptions";
    const token = CREDENTIALS['access_token'];
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Client-Id': TWITCH_CLIENT_ID,
        'Content-Type': 'application/json'
    }
    const data = {
        type: "stream.online",
        version: "1",
        condition: {"broadcaster_user_id": "000000"},
        transport: {method: "webhook", callback: "https://XXX/twitch/callback_twitch_event", secret: generateState()}
    }

    const response = res;

    getUserByUsername(streamer_username)
        .then((json) => {

            const streamer_id = json['data'][0]['id'];
            data['condition']['broadcaster_user_id'] = streamer_id;
            
            fetch(url, {
                method: "POST",
                headers: headers,
                body: JSON.stringify(data)
            })
                .then((fetchRes) => { // check code pour eviter doublons
                    console.log("FUNC ADD EVENT CODE STATUS: " + fetchRes.status); // 202 = success, 409 = Subscription already exists
                    return fetchRes.status
                })
                .then((status) => {
                    console.log(status);

                    const waitForReady = () => {
                        return new Promise(resolve => {
                            const checkReady = () => {
                                if (!eventNotifState) {
                                    resolve();
                                }
                                else {
                                    setTimeout(checkReady, 100);
                                }
                            }
                            checkReady();
                        });
                    };

                    waitForReady().then(() => { // Success                      
                        response.redirect('/twitch');
                        eventNotifState = true;
                    })
            
                })
                .catch((err) => console.error(err));
        })
})


app.get('/twitch/delete_event', (req, res) => {
    console.log(req.headers['x-forwarded-for'] + " | " + req.method, req.path); const clientIpAddress = req.headers['x-forwarded-for']; const method = req.method; const endpoint = req.path; abuseIpCheck(clientIpAddress, method, endpoint);

    if (!req.cookies['WEB_AUTH_TOKEN']) { return res.status(401).send({"error": "Unauthorized", "status": 401}); } // CHECKING IF COOKIES TO SEE AUTHENTICATION

    let event_id = req.query['queryParam'] || null;
    let token = CREDENTIALS['access_token'];
    const headers = {
        Authorization: `Bearer ${token}`,
        'Client-Id': TWITCH_CLIENT_ID
    }

    if (!event_id) { return res.status(400).send("No event_id provided")};

    const url = "https://api.twitch.tv/helix/eventsub/subscriptions" + `?id=${event_id}`;
    const response = res;

    fetch(url, {
        method: 'DELETE',
        headers: headers
    })
        .then((res) => {return {status: res.status}})
        .then((data) => {
            /*   
             * 204 => Success 
             * 400 Bad Request, 401 Unauthorized, 404 Not found
             */

            switch (data['status']) {
                case 204:

                    let state = true;
                    for (let index in event_cache['data']) {
                        if (event_cache['data'][index]['id'] == event_id) {
                            event_cache['data'].splice(index, 1);
                            state = !state;
                            console.log("Sucessfully deleted event from json['data']");
                        }
                    }
                    if (state) {
                        for (let index in event_cache['oldData']) {
                            if (event_cache['oldData'][index]['id'] == event_id) {
                                console.log("Sucessfully deleted event from json['oldData']");
                                event_cache['oldData'].splice(index, 1);
                            }
                        }
                    }

                    // ADD to cache jsp bug err a fix dbeug dajidlashjda

                    response.redirect('/twitch');
                    console.log("Sucessfully deleted event ID: " + event_id + "from events");
                    writeCache(event_cache, "EVENTS.json");
                    // response.status(200).send({message: "Sucessfully deleted event. ID: " + id, status: 200});
                    break;
                case 400:
                    console.log("DELETE EVENT ERROR CODE 400");
                    response.status(400).send({error: "id parameter is missing", status: 400});
                    break;
                case 401:
                    console.log("DELETE EVENT ERROR CODE 401");
                    response.status(401).send({error: "Unauthorized", status: 401});
                    break;
                case 404:
                    console.log("DELETE EVENT ERROR CODE 404");
                    response.status(404).send({error: "Not found", status: 404});
                    break;
            }
        })
        .catch((err) => console.error(err));

})

/*
  *  twitch-eventsub-message-id
  *  twitch-eventsub-message-type
*/
let previousMessageId = "";
app.post('/twitch/callback_twitch_event', (req, res) => {
    console.log(req.headers['x-forwarded-for'] + " | " + req.method, req.path); const clientIpAddress = req.headers['x-forwarded-for']; const method = req.method; const endpoint = req.path; abuseIpCheck(clientIpAddress, method, endpoint);

    const headers = req.headers;
    const body = req.body;
    const twitchEventSubMessageID = headers['twitch-eventsub-message-id'] || null;
    const twitchEventSubMessageType = headers['twitch-eventsub-message-type'] || null;

    if (twitchEventSubMessageID === previousMessageId) {
        console.log("Already received event");
        return res.status(400).send({"error": "Already received event.", "status": "400"})
    }
    else {
        previousMessageId = twitchEventSubMessageID;
    }

    if (twitchEventSubMessageType === "webhook_callback_verification") { // checking event
        const challengeValue = body['challenge'];
        const event = body['subscription'];
        const userId = event['condition']['broadcaster_user_id'];

        getUserById([userId])
            .then((data) => {
                event['login']                = data[userId]['login'];
                event['profile_image_url']    = data[userId]['profile_image_url'];
                event['view_count']           = data[userId]['view_count'];
                event['channel_created_at']   = data[userId]['created_at'];
                
                event_cache['data'][event_cache['data'].length] = event;
                writeCache(event_cache, 'EVENTS.json');
            })
            .then(() => { // EVENT verified
                res.status(200).send(challengeValue);
                eventNotifState = false;

            })
    }

    else if (body['subscription']['type'] == "stream.online") { // EVENT TRIGGERED =>  A stream goes online.
        const payload = body['event'];
        const streamer_id = payload['broadcaster_user_id'];
        const streamer_login = payload['broadcaster_user_login'];
        const streamer_username = payload['broadcaster_user_name'];
        const started_at = payload['started_at'];
        const streamer_data = event_cache['data'][streamer_id];
        const token = CREDENTIALS['access_token'];

        // adding a delay of 2000ms to make sure that the stream is fully loaded before getting data from the actual stream
        setTimeout(() => {

            fetch("https://api.twitch.tv/helix/streams" + "?user_id=" + streamer_id, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Client-Id': TWITCH_CLIENT_ID
                }
            })
            .then((res) => {return res.json()})
            .then((json) => {
                let title, thumbnail_url, category, started_at;

                try {
                    const data = json['data'][0];
                    title = data['title'];
                    thumbnail_url = data['thumbnail_url'].replace('{width}', "1920").replace('{height}', "1080");
                    category = data['game_name'];
                    started_at = Math.floor( new Date( Date.parse( data['started_at'] ) ).getTime() / 1000 ) ; // convert ISO 8601 timestamp to EPOCH timestamp
                }
                catch(err) {
                    return res.status(400).send({error_message: "Cannot get stream infos from /streams", status: 400});
                }

                const embed = {
                    title: streamer_username + " est en live !",
                    description: "\n**[" + title + "](https://www.twitch.tv/" + streamer_username + ")**\nPlaying `" + category + `\`\n\n📆 <t:${started_at}:f>`,
                    image: {
                        url: thumbnail_url
                    },
                    thumbnail: {
                        url: streamer_data['profile_image_url']
                    },
                    color: 11104511,
                    author: {
                        name: streamer_username,
                        url: "https://twitch.tv/" + streamer_username,
                        icon_url: streamer_data['profile_image_url']
                    }
                }

                const webhook_url = ""; // YOUR DISCORD WEBHOOK URL HERE
                fetch(webhook_url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({content: "@everyone", embeds: [embed]})
                })
                    .then(() => console.log("Sucessfully send embed | " + streamer_username))
                    .catch((err) => {throw err})
            })
            .then(() => res.status(200).send("OK"))
            .catch((err) => console.error(err))

        }, 2000); 

    }

})

app.listen(PORT);
