/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');

var client_id = '0477d3965d80465cbd1f02b376260cbc'; // Your client id
var client_secret = '4dcdc5ec2507404c847f1d6e6241d298'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

var SpotifyWebApi = require('spotify-web-api-node');

// credentials are optional
var spotifyApi = new SpotifyWebApi({
  clientId: '0477d3965d80465cbd1f02b376260cbc',
  clientSecret: '4dcdc5ec2507404c847f1d6e6241d298',
  redirectUri: 'http://localhost:8888/callback'
});


/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cors())
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        var username;

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          username = body.name;
        });

        //yayy!
        var getSongInfo = function(songId) {
          var songData;
          // console.log(songId);
          var songInfo = {
            url: 'https://api.spotify.com/v1/audio-features/' + songId,
            headers: { 'Authorization': 'Bearer ' + access_token },
            json: true
          };

          request.get(songInfo, function(error, response, body) {
              // console.log(body);
              songData = body;
          });

          return songData;
        }

        var getPlaylistInfo = function(playlistId) {
          var playlistData;
          var playlistInfo = {
                     url: 'https://api.spotify.com/v1/playlists/' + playlistId + '/tracks',
                     headers: { 'Authorization': 'Bearer ' + access_token },
                     json: true
          };

          return new Promise(
              (resolve, reject) => {
                request.get(playlistInfo, function(error, response, body){
                  if (error) reject(error);
                  let idArray = [];
                  for (var song in body.items) {
                    idArray.push(body.items[song].track.id);
                  }
                  let items = body.items; //array of item objects
                  resolve(idArray);
                });
            }
          );
        }
          // request.get(playlistInfo, function(error, response, body) {
          //     console.log("playlists below")
          //     //playlistData = ;
          //     for (var song in body.items) {
          //       console.log(body.items[song].track.id);
          //       idArray.push(body.items[song].track.id);
          //     }
          //     callback(idArray);
          // });
        // function processResponse( response ) {
        //   console.log(response);
        // }
        var playlistJSON = {}; //JSON for a particular playlist

        spotifyApi.setAccessToken(access_token);

        spotifyApi.getUserPlaylists(body.id)
          .then(function(data) {
            bodyid = data.body.items; //playlists
            for (var i = 0; i < bodyid.length; i++) { //iterating over playlists
              playlistJSON[bodyid[i].name] = bodyid[i].id; //JSON with names as keys and ids as values
             }
             //console.log(playlistJSON);
             //console.log(songArray);
              //getPlaylistInfo(bodyid.items[0].id) //gets all songs from a playlist
              //   .then(function itworks(response) {
              //     songArray.push(response) //adds all song ids to songArray
              //     console.log('song array');
              //     console.log(songArray);

              //     res.redirect('/#' +
              //       querystring.stringify({
              //       access_token: access_token,
              //       refresh_token: refresh_token,
              //       bodyid: bodyid
              //     }));
              //   })
              //   .catch(function doesntwork(err) {
              //       console.error(err)
              //   })
              console.log(playlistJSON)
              res.redirect('/#' +
                querystring.stringify({
                access_token: access_token,
                refresh_token: refresh_token,
                bodyid: playlistJSON.Khalid
              }));
          },function(err) {
            console.log('Something went wrong!', err);
          });



        // we can also pass the token to the browser to make requests from there

      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);
