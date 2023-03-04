const path = require('path');
require('dotenv').config();
const fs = require('fs');
const { 
    getCache, 
    writeCache
} = require('./globals');
const {mainDirname} = require('./server');

const TWITCH_CLIENT_ID = "";
const TWITCH_CLIENT_SECRET = "";
let CREDENTIALS = process.env.TWITCH_TOKEN;
let streamers_event = [];
let event_cache_ = getCache("EVENTS.json");

// APP ACCESS TOKENS last for 55 days ...
async function getCredentials() {
    
	const grant_type = "client_credentials";
	const url = "https://id.twitch.tv/oauth2/token";
	const body = {
		'client_id': TWITCH_CLIENT_ID,
		'client_secret': TWITCH_CLIENT_SECRET,
		'grant_type': grant_type
	}

    let left = Date.now() - CREDENTIALS['created_at'];
    let right = CREDENTIALS['expires_in'];

    if ((Date.now() - CREDENTIALS['created_at'] || 0) >= ( (CREDENTIALS['expires_in']*1000) || 1)) { // OUTDATED TOKEN... || OR to avoid getting NaN value
        console.log("TOKEN IS OUTDATED");
        return fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
                body: new URLSearchParams(body)
            })
            
            .then((data) => {
                return data.json();
            })
            .then((json) => {
                console.log(json);
                const token = json['access_token'];
                const expires_in = json['expires_in'];
                const created_at = Date.now(); // EPOCH TIMESTAMP IN MS
                
                fs.writeFile(path.join(mainDirname, 'cache', 'twitchToken.json'), JSON.stringify( {'access_token': token, 'expires_in': expires_in, 'created_at': created_at} ), (err) => {
                    if (err) { console.error(err) } else { console.log("Successfully write in twitchToken.json") }
                });

                return token;
            })
    
            .catch((err) => {
                console.error(err);
                return err;
                // response.status(200).send("errorrr");
            })
    }
    
    else {
        console.log("TOKEN STILL GOOD")
        return new Promise((resolve) => {
            var token = CREDENTIALS['access_token'];
            resolve(token)
            return token;
        })
    }

}

async function getEvents(res, url, method, headers) {
    const response = res;

    return fetch(url, {
        method: method,
        headers: headers
        // body: body
        })

        .then((fetchRes) => {
            return fetchRes.json();
        })

        .then((json) => {
            if (json.status == 401) { // 401 = Unauthorized, if token outdated then recursivity request ...
                getCredentials()
                    .then((token) => {
                        console.log("new token is " + token);
                        headers['Authorization'] = token;
                        getEvents(response, url, method, headers);
                        return
                    })
            }

            else {
                var ids = [];
                for (let index of json['data']) {
                    ids.push(index['condition']['broadcaster_user_id']);
                }

                getUserById(ids)
                    .then((user) => { // json = event & userJson = getUser() !!!
                        // userJson = { data: [ {}, {}, ... ] }
                        
                        let newJson = {
                            data: {},
                            oldData: {}
                        }

                        for (let event of json['data']) {
                            let userId = event['condition']['broadcaster_user_id'];

                            if (!streamers_event.includes( user[userId]['login'].toLowerCase() )) {
                                streamers_event.push( user[userId]['login'].toLowerCase() );
                            }
                            
                            event['login']                = user[userId]['login'];
                            event['profile_image_url']    = user[userId]['profile_image_url'];
                            event['view_count']           = user[userId]['view_count'];
                            event['channel_created_at']   = user[userId]['created_at'];
                            
                            if (event['status'] != "enabled") { // del event unavailable
                                newJson['oldData'][userId] = event;
                                // newJson['oldData'].push(event);
                                continue;
                            }
                            else {
                                newJson['data'][userId] = event;
                                //newJson['data'].push(event);
                            }
                        }

                        event_cache_ = newJson;
                        writeCache(newJson, 'EVENTS.json'); // event_cache_
                        
                        // res.status(200).send(newJson);
                        res.status(200).render('twitch', newJson);
                    })
                
            }
            return json;
        })
    
        .catch((err) => {
            res.redirect("/twitch/get_events");
            console.error(err);
        })
}

async function getUserById(ids) {
    var url = "https://api.twitch.tv/helix/users?";
    const token = CREDENTIALS['access_token'];
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Client-id': TWITCH_CLIENT_ID
    };
    
    for (var id of ids) {
        url += `id=${id}&`;
    }

    return fetch(url, {
        method: "GET",
        headers: headers
        })

        .then((res) => {
            return res.json();
        })

        .then((json) => {
            let data = {};
            for (let obj of json['data']) {
                data[obj['id']] = obj;
            }
            return data;
        })
}

async function getUserByUsername(username) {
    var url = "https://api.twitch.tv/helix/users?";
    const token = CREDENTIALS['access_token'];
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Client-id': TWITCH_CLIENT_ID
    };

    return fetch(url + `login=${username}`, {
        method: "GET",
        headers: headers
        })

        .then((res) => {
            return res.json();
        })
}



module.exports = {
    getCredentials,
    getEvents,
    getUserById,
    getUserByUsername,
    TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET,
    CREDENTIALS,
    streamers_event,
    event_cache_
}