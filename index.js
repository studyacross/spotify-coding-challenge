/**
 * the Spotify Accounts.
 */
require('dotenv').config();
const express = require('express'); // Express web server framework
const bodyParser = require('body-parser')
const request = require('request'); // "Request" library
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const { Sequelize } = require('sequelize');
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  port: process.env.DB_PORT
});

const client_id = process.env.CLIENT_ID; // Your client id
const client_secret = process.env.CLIENT_SECRET; // Your secret
const Op = Sequelize.Op;

try {
  sequelize.authenticate();
  console.log('Connection has been established successfully.');
} catch (error) {
  console.error('Unable to connect to the database:', error);
}

// Tracks table model declare
const Track = sequelize.define(
  "Track", {
  isrc: Sequelize.STRING,
  album_name: Sequelize.STRING,
  artist_name: Sequelize.STRING,
  album_images: Sequelize.STRING

}, {
  timestamps: false
});

const app = express();

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
// your application requests authorization
app.post('/insertData', async function (req, res) {

  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
    },
    form: {
      grant_type: 'client_credentials'
    },
    json: true
  };

  request.post(authOptions, async function (error, response, body) {
    if (!error && response.statusCode === 200) {

      // use the access token to access the Spotify Web API
      var token = body.access_token;
      var options = {
        url: 'https://api.spotify.com/v1/search?q=isrc:' + req.body.isrc + '&type=track&limit=50',
        headers: {
          'Authorization': 'Bearer ' + token
        },
        json: true
      };
      request.get(options, async function (error, response, body) {
        console.log("Tracking data===", body);
        console.log("Tracking data length==", body.tracks.items.length);
        Track
          .findAndCountAll({
            where: {
              isrc: req.body.isrc
            }
          })
          .then(result => {
            console.log(result.count);
            console.log(result.rows);
            if (result.count > 0) {
              res.status(400).json({ 'status': false, 'message': 'Already exist' });
            }
            else {
              if (body.tracks.items.length > 0) {
                let title, imgUrl, artistList = '',allTrack = [];
                body.tracks.items.forEach((item, index) => {
                  allTrack.push(item.popularity);
                  
                });
                var result = allTrack.indexOf(Math.max(...allTrack));
                console.log("Track index==",allTrack);
                console.log("Highest popilarity===",result);
                title = body.tracks.items[result].album.name;
                imgUrl = body.tracks.items[result].album.images[0].url;
                body.tracks.items[result].artists.forEach((artist, artist_index) => {
                  artistList = artistList + artist.name + ",";
                });
                artistList = artistList.slice(0, -1);
                res.status(200).json({'status':true,'title': title, 'artist': artistList, 'image': imgUrl });
                //res.status(200).json(body);
                Track.create({
                  isrc: req.body.isrc,
                  album_name: title,
                  artist_name: artistList,
                  album_images: imgUrl
                });

              }
              else {
                res.status(400).json({ 'status': false, 'message': 'Sorry no data found' });
              }
            }
          });
      });
    }
  });
});

app.post('/getDataByISRC', async function (req, res) {
  Track
    .findAndCountAll({
      where: {
        isrc: req.body.isrc
      }
    })
    .then(result => {
      console.log(result.count);
      console.log(result.rows);
      if (result.count > 0) {
        let allData = [];
        result.rows.map((r) => {
          console.log(r.dataValues);
          allData.push(r.dataValues);
        })
        res.status(200).json({ 'status': true,'count':result.count, 'data': allData });
      }
      else {
        res.status(400).json({ 'status': false, 'message': 'Sorry no data found' });
      }
    });
});

app.post('/getDataByArtist', async function (req, res) {
  Track
    .findAndCountAll({
      where: {
        artist_name: {
          [Op.like]: '%' + req.body.artist + '%'
        }
      }
    })
    .then(result => {
      //console.log(result.count);
      // console.log(result.rows);
      if (result.count > 0) {
        let allData = [];
        result.rows.map((r) => {
          console.log(r.dataValues);
          allData.push(r.dataValues);
        })
        res.status(200).json({ 'status': true,'count':result.count, 'data': allData });
      }
      else {
        res.status(400).json({ 'status': false, 'message': 'Sorry no data found' });
      }
    });
});

console.log('Listening on '+process.env.APP_PORT);
app.listen(process.env.APP_PORT);
