//@ts-check
// ...
'use strict';
import 'dotenv/config';

// COD API stuff.
import express from "express";
import uniqid from 'uniqid';
import crypto from 'crypto';

// HTTP utility.
import axios from 'axios';
import got from 'got';

// Twitch and Discord bots.
import tmi from 'tmi.js';
import { Client, Intents } from "discord.js";
import { firefox } from 'playwright-firefox';
import { BrowserPool, PlaywrightPlugin } from 'browser-pool';

// Games,
import * as wordle from './games/wordle.js';
import * as revolverroulette from './games/revolverroulette.js';
import * as coinflip from './games/coinflip.js';
import * as rps from './games/rockpaperscissors.js';
import * as bigvanish from './games/bigvanish.js';

// DateTime.
import { DateTime } from 'luxon';

// Import Pool for accessing the database.
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
});

// Page settings.
import randomUseragent from 'random-useragent';

// Browser pool.
const browserPool = new BrowserPool({
  browserPlugins: [new PlaywrightPlugin(firefox, {
    useIncognitoPages: true,
    launchOptions: {
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=${process.env.PROXY}`
      ],
      proxy: {
        server: `http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
        username: process.env.PROXY_USER,
        password: process.env.PROXY_PASS
      }
    },
    proxyUrl: process.env.PROXY
  })],
  useFingerprints: true,
});

// Cooldowns for games.
let rrcd = [], rpscd = [], cfcd = [], bvcd = [];

// Global cooldowns.
let gcd = [];

// Active elements for each user.
let userIds = {};

// Configuration for Twitch API.
const client_config = {
  "client_id": process.env.CLIENT_ID,
  "client_secret": process.env.CLIENT_SECRET
};

// More configuration for Twitch API.
const account_config = {
  "access_token": process.env.ACCESS_TOKEN,
  "refresh_token": process.env.REFRESH_TOKEN,
  "scope": [
      "channel:manage:redemptions",
      "channel:read:redemptions"
  ],
  "token_type": "bearer"
};

// Discord bot.
const discord = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES]
});

// Logs the Discord bot being initialized.
discord.once('ready', () => {
	console.log('Discord bot logged on.');
});

// Loadout command for Discord.
const prefix = "!loadout";
discord.on("messageCreate", (message) => {
  if (message.channel.id !== "775090169417826326") return;
	if (message.content.startsWith(prefix)) {
		try {
		  message.author.send("HusKerrs' Loadouts (favorite guns at the top): https://www.kittr.gg/channel/HusKerrs/warzone\n"+
		  "If you're having trouble accessing the loadout site, please DM @zHekLeR on Twitch or Discord.");
		} catch (err) {
			console.log(err);
		}
	}
});

// Log in to the Discord bot.
discord.login(process.env.TOKEN);

// Create the Twitch bot.
const bot = new tmi.Client({
	connection: {
		reconnect: true,
		secure: true
	},
	identity: {
		username: 'zhekler',
		password: process.env.TWITCH_BOT
	},
  channels: [ ]
});

// Logs the Twitch bot being initialized.
bot.on('logon', () => {
  console.log("Twitch bot logged on.");
})

// Check for commands and respond appropriately.
bot.on('chat', async (channel, tags, message) => {
  try {

    // Return if not a command.
    if (!message.startsWith('!')) return;

    // Get command.
    let short = message.split(' ')[0].toLowerCase();

    // Check/set global cooldown on command.
    if (gcd[short] && gcd[short] > Date.now()) return;
    gcd[short] = Date.now() + 3000;

    // Base values.
    let client, res, placement, kills, multis, score, str;

    // Switch on given command.
    switch (short) {
      case '!rron': 
        if (userIds[channel.substring(1)].revolverroulette || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET revolverroulette = true WHERE user_id = '${channel.substring(1)}';`)
        client.release();
        userIds[channel.substring(1)].revolverroulette = true;
        bot.say(channel, `Revolver Roulette has been enabled. Type !rr to play!`);
        break;

      case '!rroff': 
        if (!userIds[channel.substring(1)].revolverroulette || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET revolverroulette = false WHERE user_id = '${channel.substring(1)}';`)
        client.release();
        userIds[channel.substring(1)].revolverroulette = false;
        bot.say(channel, `Revolver Roulette has been disabled.`);
        break;

      case '!rr': 
        if (!userIds[channel.substring(1)].revolverroulette) break;
        if (!rrcd[tags["username"]] || rrcd[tags["username"]] < Date.now()) {
          bot.say(channel, await revolverroulette.revolverroulette(tags["display-name"]?tags["display-name"]:tags["username"]));
          rrcd[tags["username"]] = Date.now() + 300000;
        }
        break;

      case '!rrscore':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        bot.say(channel, await revolverroulette.revolverrouletteScore(tags["display-name"]?tags["display-name"]:tags["username"]));
        break;

      case '!rrscoreother':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        bot.say(channel, await revolverroulette.revolverrouletteScore(message.split(' ')[1]));
        break;

      case '!rrlb':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        bot.say(channel, await revolverroulette.revolverrouletteLb());
        break;

      case '!rrtotals':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        bot.say(channel, await revolverroulette.revolverrouletteTotals());
        break;

      case '!gamestats':
        if (!userIds[channel.substring(1)].coinflip || !userIds[channel.substring(1)].rps || !userIds[channel.substring(1)].revolverroulette) break;
        bot.say(channel, await revolverroulette.allTimes(tags["display-name"]?tags["display-name"]:tags["username"]));
        break;

      case '!coinon':
        if (userIds[channel.substring(1)].coinflip || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET coinflip = true WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].coinflip = true;
        bot.say(channel, `Coinflip enabled.`);
        break;

      case '!coinoff':
        if (!userIds[channel.substring(1)].coinflip || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET coinflip = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].coinflip = false;
        bot.say(channel, `Coinflip disabled.`);
        break;

      case '!coin':
        if (!userIds[channel.substring(1)].coinflip) break;
        if (!tags["subscriber"]) break;
        if (!cfcd[tags["username"]] || cfcd[tags["username"]] < Date.now()) {
          bot.say(channel, await coinflip.coinflip(tags["display-name"]?tags["display-name"]:tags["username"], message.split(' ')[1]));
          rrcd[tags["username"]] = Date.now() + 15000;
        }
        break;

      case '!coinscore':
        if (!userIds[channel.substring(1)].coinflip) break;
        bot.say(channel, await coinflip.coinflipScore(tags["display-name"]?tags["display-name"]:tags["username"]));
        break;

      case '!coinlb':
        if (!userIds[channel.substring(1)].coinflip) break;
        bot.say(channel, await coinflip.coinflipLb());
        break;

      case '!rpson':
        if (userIds[channel.substring(1)].rps || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET rps = true WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].rps = true;
        bot.say(channel, `Rock paper scissors enabled.`);
        break;

      case '!rpsoff':
        if (!userIds[channel.substring(1)].rps || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET rps = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].rps = false;
        bot.say(channel, `Rock paper scissors disabled.`);
        break;

      case '!rps': 
      if (!userIds[channel.substring(1)].rps) break;
      if (!tags["subscriber"]) break;
        if (!rpscd[tags["username"]] || rpscd[tags["username"]] < Date.now()) {
          bot.say(channel, await rps.rps(tags["display-name"]?tags["display-name"]:tags["username"], message.split(' ')[1]));
          rrcd[tags["username"]] = Date.now() + 15000;
        }
        break;

      case '!rpsscore': 
      if (!userIds[channel.substring(1)].rps) break;
        bot.say(channel, await rps.rpsScore(tags["display-name"]?tags["display-name"]:tags["username"]));
        break;

      case '!rpslb':
        if (!userIds[channel.substring(1)].rps) break;
        bot.say(channel, await rps.rpsLb());
        break;

      case '!bigvanishon':
        if (userIds[channel.substring(1)].bigvanish || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET bigvanish = true WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].bigvanish = true;
        bot.say(channel, `Bigvanish enabled.`);
        break;

      case '!bigvanishoff':
        if (!userIds[channel.substring(1)].bigvanish || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET bigvanish = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].bigvanish = false;
        bot.say(channel, `Bigvanish disabled.`);
        break;

      case '!bigvanish':
        if (!userIds[channel.substring(1)].bigvanish) break;
        if (!bvcd[tags["username"]] || bvcd[tags["username"]] < Date.now()) {
          bot.say(channel, await bigvanish.bigVanish(tags["display-name"]?tags["display-name"]:tags["username"]));
          rrcd[tags["username"]] = Date.now() + 15000;
          setTimeout(function() { bot.say(channel, `/untimeout ${tags["username"]}`); }, 3000);
        }
        break;

      case '!bigvanishlb':
        if (!userIds[channel.substring(1)].bigvanish) break;
        bot.say(channel, await bigvanish.bigVanishLb());
        break;

      case '!bigvanishlow':
        if (!userIds[channel.substring(1)].bigvanish) break;
        bot.say(channel, await bigvanish.bigVanishLow());
        break;

      case '!customon':
        if (userIds[channel.substring(1)].customs || !tags["mod"]) break;
        bot.say(channel, '!enable !score false');
        bot.say(channel, '!enable !mc false');
        client = await pool.connect();
        await client.query(`UPDATE allusers SET customs = true WHERE user_id = '${channel.substring(1)};`)
        client.release();
        userIds[channel.substring(1)].customs = true;
        break;

      case '!customoff':
        if (!userIds[channel.substring(1)].customs || !tags["mod"]) break;;
        bot.say(channel, '!enable !score true');
        bot.say(channel, '!enable !mc true');
        client = await pool.connect();
        await client.query(`UPDATE allusers SET customs = false WHERE user_id = '${channel.substring(1)};`);
        client.release();
        userIds[channel.substring(1)].customs = false;
        break;

      case '!setmaps': 
        if (!userIds[channel.substring(1)].customs || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE customs SET map_count = ${parseInt(message.split(' ')[1])} WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        bot.say(channel, `Map count has been set to ${message.split(' ')[1]}`);
        break;

      case '!setplacement':
        if (!userIds[channel.substring(1)].customs || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE customs SET multipliers = '${message.substring(message.indexOf(' ') + 1)}' WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        bot.say(channel, `Placement multipliers have been updated.`);
        break;

      case '!addmap':
        if (!userIds[channel.substring(1)].customs || !tags["mod"]) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM customs WHERE user_id = '${channel.substring(1)}';`);
        placement = parseInt(message.split(' ')[1]);
        kills = parseInt(message.split(' ')[2]);
        multis = res.rows[0].multipliers.split(' ');
        for (let i = multis.length/2; i >= 0; i--) {
          if (placement >= parseInt(multis[2*i])) {
            score = kills * parseFloat(multis[(2*i)+1]);
            break;
          }
        }
        res.rows[0].maps.placement.push(placement);
        res.rows[0].maps.kills.push(kills);
        await client.query(`UPDATE customs SET maps = '{"placement":${'[' + res.rows[0].maps.placement.join(',') + ']'},"kills":${'[' + res.rows[0].maps.kills.join(',') + ']'}}' WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        if (placement > 3 && placement < 21) {
          placement = `${placement}th`;
        } else if (`${placement}`.charAt(`${placement}`.length - 1) === '1') {
          placement = `${placement}st`;
        } else if (`${placement}`.charAt(`${placement}`.length - 1) === '2') {
          placement = `${placement}nd`;
        } else if (`${placement}`.charAt(`${placement}`.length - 1) === '3') {
          placement = `${placement}rd`;
        } else {
          placement = `${placement}th`;
        }
        bot.say(channel, `Team HusKerrs got ${placement} place with ${kills} kills for ${score.toFixed(2)} points!`);
        break;

      case '!removemap':
        if (!userIds[channel.substring(1)].customs || !tags["mod"]) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM customs WHERE user_id = '${channel.substring(1)}';`);
        res.rows[0].maps.placement.length = res.rows[0].maps.placement.length?res.rows[0].maps.placement.length-1:0;
        res.rows[0].maps.kills.length = res.rows[0].maps.kills.length?res.rows[0].maps.kills.length-1:0;
        await client.query(`UPDATE customs SET maps = '{"placement":${res.rows[0].maps.placement.length?'['+res.rows[0].maps.placement.join(',')+']':'[]'},"kills":${res.rows[0].maps.kills.length ?'['+res.rows[0].maps.kills.join(',')+']':'[]'}}::json' WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        bot.say(channel, `Last map has been removed.`);
        break;

      case '!mc':
        if (!userIds[channel.substring(1)].customs) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM customs WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        if (res.rows[0].maps.placement.length == res.rows[0].map_count) {
          str = `All maps have been played huskGG`;
        } else {
          str = `Map ${res.rows[0].maps.placement.length + 1} of ${res.rows[0].map_count}`;
        }
        bot.say(channel, str);
        break;

      case '!score':
        if (!userIds[channel.substring(1)].customs) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM customs WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        score = [];
        let total = 0;
        multis = res.rows[0].multipliers.split(' ');
        for (let i = 0; i < res.rows[0].maps.placement.length; i++) {
          for (let j = multis.length/2; j > 0; j--) {
            if (parseInt(res.rows[0].maps.placement[i]) >= parseInt(multis[2*j])) {
              placement = parseFloat(multis[(2*j)+1]);
              break;
            }
          }
          score.push(`Map ${i + 1}: ${(res.rows[0].maps.kills[i] * placement).toFixed(2)}`);
          total += res.rows[0].maps.kills[i] * placement;
        }
        str = score.join(' | ');
        if (score.length < res.rows[0].map_count) str += score.length?` | Map ${score.length + 1}: TBD`:`Map 1: TBD`;
        str += ` | Total: ${total.toFixed(2)} pts`;
        bot.say(channel, str);
        break;

      case '!resetmaps':
        if (!userIds[channel.substring(1)].customs || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE customs SET maps = '{"placement":[],"kills":[]}' WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        bot.say(channel, `Maps have been reset.`);
        break;

      case '!matcheson':
        if (userIds[channel.substring(1)].matches || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET matches = true WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].matches = true;
        bot.say(channel, `Matches disabled.`);
        break;

      case '!matchesoff':
        if (!userIds[channel.substring(1)].matches || !tags["mod"]) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET matches = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].matches = false;
        bot.say(channel, `Matches enabled.`);
        break;

      case '!lastgame':
        if (!userIds[channel.substring(1)].matches) break;
        bot.say(channel, await lastGame(userIds[channel.substring(1)].acti_id));
        break;

      case '!lastgames':
      case '!weekly':
        if (!userIds[channel.substring(1)].matches) break;
        bot.say(channel, await lastGames(userIds[channel.substring(1)].acti_id));
        break;

      case '!daily':
        if (!userIds[channel.substring(1)].matches) break;
        bot.say(channel, await daily(userIds[channel.substring(1)].acti_id));
        break;

      case '!bombs':
        if (!userIds[channel.substring(1)].matches) break;
        bot.say(channel, await bombs(userIds[channel.substring(1)].acti_id));
        break;

      case '!wins': 
      if (!userIds[channel.substring(1)].matches) break;
        bot.say(channel, await wins(userIds[channel.substring(1)].acti_id));
        break;

      case '!gulag':
        if (!userIds[channel.substring(1)].matches) break;
        bot.say(channel, await gulag(userIds[channel.substring(1)].acti_id));
        break;

      case '!stats':
      case '!kd':
        if (!userIds[channel.substring(1)].matches) break;
        bot.say(channel, await stats(userIds[channel.substring(1)].acti_id, userIds[channel.substring(1)].platform));
        break;

      case '!kobe':
      case '!semtex':
        if (channel.substring(1) !== 'huskerrs') break;
        bot.say(channel, await semtex());
        break;

      case '!teammates':
        if (!userIds[channel.substring(1)].matches) break;
        bot.say(channel, await teammates(userIds[channel.substring(1)].acti_id));
        break;

      case '!modes':
      case '!gamemodes':
        if (!userIds[channel.substring(1)].matches) break;
        bot.say(channel, await gamemodes(userIds[channel.substring(1)].acti_id));
        break;

      case '!check':
        if (!userIds[channel.substring(1)].matches || !tags["mod"]) break;
        // @ts-ignore
        bot.say(channel, await check(encodeURIComponent(message.split(' ')[1])));
        break;

      case '!zhekleave':
        if (tags["username"] !== channel.substring(1)) break;
        bot.say(channel, 'peepoLeave');
        bot.part(channel);
        break;

    }
  } catch (err) {
    console.log(`Twitch bot commands: ${err}`);
  }
});


// Twitch bot subscription handler.
bot.on('subscription', (channel, username, method, message, userstate) => {
  if (!userIds[channel.substring(1)].subs) return;
  bot.say(channel, `${username} Thank you for the sub, welcome to the Huskies huskHype huskLove`);
});


// Twitch bot resubscription handler.
bot.on('resub', (channel, username, months, message, userstate, methods) => {
  if (!userIds[channel.substring(1)].subs) return;
  bot.say(channel, `${username} Thank you for the ${userstate['msg-param-cumulative-months']} month resub huskHype huskLove`);
});


// Make the COD API game_mode more readable.
let game_modes = {
  'br_brquads': 'Battle Royale Quads',
  'br_brtrios': 'Battle Royale Trios',
  'br_brduos': 'Battle Royale Duos',
  'br_brsolo': 'Battle Royale Solos',
  'br_vg_royale_quads': 'Vanguard Royale Quads',
  'br_vg_royale_trio': 'Vanguard Royale Trios',
  'br_vg_royale_duo': 'Vanguard Royale Duos',
  'br_vg_royale_solo': 'Vanguard Royale Solos',
  'br_dmz_plunquad': 'Plunder Quads',
  'br_dmz_pluntrio': 'Plunder Trios',
  'br_dmz_plunduo': 'Plunder Duos',
  'br_dmz_plunsolo': 'Plunder Solos',
  'br_buy_back_quads': 'Buyback Quads',
  'br_buy_back_trios': 'Buyback Trios',
  'br_buy_back_duos': 'Buyback Duos',
  'br_buy_back_solos': 'Buyback Solos',
  'br_rebirth_rbrthquad': 'Resurgence Quads',
  'br_rebirth_rbrthtrios': 'Resurgence Trios',
  'br_rebirth_rbrthduos': 'Resurgence Duos',
  'br_rebirth_rbrthsolos': 'Resurgence Solos',
  'br_rebirth_reverse_playlist_wz325/rbrthsolos': 'Rebirth Reverse',
  'br_rebirth_reverse_playlist_wz325/rbrthduos': 'Rebirth Reverse',
  'br_rebirth_reverse_playlist_wz325/rbrthtrios': 'Rebirth Reverse',
  'br_rebirth_reverse_playlist_wz325/rbrthquads': 'Rebirth Reverse',
  'br_rumble_clash_caldera': 'Clash',
  'br_dmz_playlist_wz325/rbrthbmo_quads': 'Rebirth Reinforced Quads',
  'br_dmz_playlist_wz325/rbrthbmo_trios': 'Rebirth Reinforced Trios',
  'br_dmz_playlist_wz325/rbrthbmo_duos': 'Rebirth Reinforced Duos',
  'br_dmz_playlist_wz325/rbrthbmo_solos': 'Rebirth Reinforced Solos'
};

let baseCookie = "new_SiteId=cod; ACT_SSO_LOCALE=en_US;country=US;";
let loggedIn = false;
let mCache = {};


let apiAxios = axios.create({
  headers: {
    // @ts-ignore
    common: {
      "content-type": "application/json",
      "cookie": baseCookie,
      "x-requested-with": process.env.USER_AGENT,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      "Connection": "keep-alive"
    }
  },
  withCredentials: true
});
console.log("Created apiAxios.");


let loginAxios = apiAxios;
let defaultBaseURL = "https://my.callofduty.com/api/papi-client/";

let symAxios = axios.create({
  headers: {
      'Client-ID': client_config.client_id,
      'Authorization': 'Bearer ' + account_config.access_token,
      'Accept': "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
      'content-type': 'application/json',
      'Connection': 'keep-alive'
  },
  withCredentials: true
});
console.log("Created symAxios.");


function apiErrorHandling(error) {
  if (!!error) {
      let response = error.response;
      if (!!response) {
          switch (response.status) {
              case 200:
                  const apiErrorMessage = (response.data !== undefined && response.data.data !== undefined && response.data.data.message !== undefined) ? response.data.data.message : (response.message !== undefined) ? response.message : 'No error returned from API.';
                  switch (apiErrorMessage) {
                      case 'Not permitted: user not found':
                          return '404 - Not found. Incorrect username or platform? Misconfigured privacy settings?';
                      case 'Not permitted: rate limit exceeded':
                          return '429 - Too many requests. Try again in a few minutes.';
                      case 'Error from datastore':
                          return '500 - Internal server error. Request failed, try again.';
                      default:
                          return apiErrorMessage;
                  }
                  break;
              case 401:
                  return '401 - Unauthorized. Incorrect username or password.';
              case 403:
                  return '403 - Forbidden. You may have been IP banned. Try again in a few minutes.';
              case 500:
                  return '500 - Internal server error. Request failed, try again.';
              case 502:
                  return '502 - Bad gateway. Request failed, try again.';
              default:
                  return `We Could not get a valid reason for a failure. Status: ${response.status}`;
          }
      } else {
          return `We Could not get a valid reason for a failure. Status: ${error}`;
      }
  } else {
      return `We Could not get a valid reason for a failure.`;
  }
};

function postReq(url, data, headers = null) {
  return new Promise((resolve, reject) => {
      loginAxios.post(url, data, headers).then(response => {
          resolve(response.data);
      }).catch((error) => {
          reject(apiErrorHandling(error));
      });
  });
};

function sendRequest(url) {
  return new Promise((resolve, reject) => {
      if (!loggedIn) reject("Not Logged In.");
      apiAxios.get(url).then(response => {

          if (response.data.status !== undefined && response.data.status === 'success') {
              resolve(response.data.data);
          } else {
              reject(apiErrorHandling({
                  response: response
              }));
          }
      }).catch((error) => {
          reject(apiErrorHandling(error));
      });
  });
};

function loginWithSSO (sso) {
  return new Promise(async (resolve, reject) => {
      if (typeof sso === "undefined" || sso.length <= 0) reject("SSO token is invalid.");
      let loginURL = "https://profile.callofduty.com/cod/mapp/";
      let randomId = uniqid();
      let md5sum = crypto.createHash('md5');
      let deviceId = md5sum.update(randomId).digest('hex');
      postReq(`${loginURL}registerDevice`, {
          'deviceId': deviceId
      }).then((response) => {
          console.log(response);
          let authHeader = response.data.authHeader;
          let fakeXSRF = "68e8b62e-1d9d-4ce1-b93f-cbe5ff31a041";
          apiAxios.defaults.headers.common.Authorization = `bearer ${authHeader}`;
          apiAxios.defaults.headers.common.x_cod_device_id = `${deviceId}`;
          apiAxios.defaults.headers.common["X-XSRF-TOKEN"] = fakeXSRF;
          apiAxios.defaults.headers.common["X-CSRF-TOKEN"] = fakeXSRF;
          apiAxios.defaults.headers.common["Acti-Auth"] = `Bearer ${sso}`;
          apiAxios.defaults.headers.common["cookie"] = baseCookie + `${baseCookie}ACT_SSO_COOKIE=${sso};XSRF-TOKEN=${fakeXSRF};API_CSRF_TOKEN=${fakeXSRF};`;;
          loggedIn = true;
          resolve("200 - Logged in with SSO.");
      }).catch((err) => {
          if (typeof err === "string") reject(err);
          reject(err.message);
      });
  });
};

function last20(gamertag, platform) {
  return new Promise((resolve, reject) => {
      let urlInput = defaultBaseURL + `crm/cod/v2/title/mw/platform/${platform}/gamer/${gamertag}/matches/wz/start/0/end/0/details`;
      sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
  });
};

// Pull match info from match ID.
function matchInfo(matchID) {
  return new Promise((resolve, reject) => {
      let urlInput = defaultBaseURL + `crm/cod/v2/title/mw/platform/acti/fullMatch/wz/${matchID}/en`;
      sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
  });
};


// Pull lifetime stats from COD API.
function lifetime(gamertag, platform) {
  return new Promise((resolve, reject) => {
    let urlInput = defaultBaseURL + `stats/cod/v1/title/mw/platform/${platform}/gamer/${gamertag}/profile/type/wz`;
    sendRequest(urlInput).then(data => resolve(data)).catch(e => reject(e));
  });
};


// Create server.
const app = express();


// Home page.
import fs from 'fs';
app.get('/', (request, response) => {
  const homepage = fs.readFileSync("./page.html").toString('utf-8');
  response.send(homepage);
});


// API endpoint to format ban statements for accounts in BrookeAB's chat which were created and followed within 6 hours.
app.get('/brookescribers', async (request, response) => {
  try {

    // Pull accounts from database.
    let client = await pool.connect();
    let res = await client.query('SELECT * FROM brookescribers;');
    let rows = res.rows;
    client.release();

    // Format string of ban statements.
    let str = '';
    for (let i = 0; i < rows.length; i++) {
      str += `/ban ${rows[i].user_id} <br/>`;
    }

    // Return response.
    response.send(`${str===''?'None':str}`);

  } catch (err) {
    console.log(err);
    response.send("Error during brookscribers");
  }
});

app.get('/check/:id', async (request, response) => {
  try {
    console.log(`Checking ${request.params.id}`);
    response.send(await check(request.params.id));
    console.log(`Checked ${request.params.id}`);
  } catch (err) {
    console.log(err);
    response.send(err);
  }
})


async function check(id) {
  try {
    const userAgent = randomUseragent.getRandom();
    const UA = userAgent || process.env.USER_AGENT;

    const page = await browserPool.newPage();

    await page.setExtraHTTPHeaders({ userAgent: UA, 'Accept-Language': 'en' });

    await page.goto(`https://api.tracker.gg/api/v2/warzone/standard/profile/atvi/${id}`, { waitUntil: 'domcontentloaded' });

    let data = await page.content();

    console.log(data.substring(0,30));

    return;

  } catch (err) {
    console.log(`Check: ${err}`);
    return;
  }
};


// Get user's stats.
app.get('/stats/:id', async (req, response) => {
  try {
    response.send(await stats(req.params.id, 'uno'));
  } catch (err) {
    console.log(`Error while getting other stats: ${err}`);
    response.send(`Error while getting stats.`)
  }
});


// Get user's stats.
async function stats(username, platform) {
  try {

    // Get stats.
    let data = await lifetime(username, platform);

    // Format stats.
    let time = `${(data.lifetime.mode.br.properties.timePlayed/3600).toFixed(2)} Hours`;
    let lk = data.lifetime.mode.br.properties.kdRatio.toFixed(2);
    let wk = data.weekly.mode.br_all?data.weekly.mode.br_all.properties.kdRatio.toFixed(2):'-';
    let wins = data.lifetime.mode.br.properties.wins;
    let kills = data.lifetime.mode.br.properties.kills;

    // Return response.
    return `${decodeURIComponent(username)} | Time Played: ${time} | Lifetime KD: ${lk} | Weekly KD: ${wk} | Total Wins: ${wins} | Total Kills: ${kills}`;

  } catch (err) {
    console.log(`Stats: ${err}`);
    return;
  }
};


// Add specific match to database.
app.get('/addmatch/:matchid/:userid', async (req, response) => {
  try {
    // Get all players for this match.
    let players = (await matchInfo(req.params.matchid)).allPlayers;

    // String to add.
    let addStr = '';

    // Get timestamp.
    let timestamp, placement, kills, deaths, gulag_kills, gulag_deaths, streak, game_mode;
    let lobby_kd = 0;

    // Find user's team name.
    let teamName;
    for (let j = 0; j < players.length; j++) {
      if (players[j].player.uno === String(userIds[req.params.userid].uno_id)) {
        teamName = players[j].player.team;
        timestamp = players[j].utcStartSeconds;
        placement = players[j].playerStats.teamPlacement;
        kills = players[j].playerStats.kills;
        deaths = players[j].playerStats.deaths;
        gulag_kills = players[j].playerStats.gulagKills;
        gulag_deaths = players[j].playerStats.gulagDeaths;
        streak = players[j].playerStats.longestStreak;
        game_mode = game_modes[players[j].mode];
        break;
      }
    }
    
    // Teammates?
    let teammates = [];
    for (let j = 0; j < players.length; j++) {
      if (players[j].player.team === teamName && players[j].player.uno !== String(userIds[req.params.userid].uno_id)) {
        let player = { name: players[j].player.username, kills: players[j].playerStats.kills, deaths: players[j].playerStats.deaths };
        teammates.push(player);
        if (teammates.length == 3) break;
      }
    }

    // Format placement.
      placement = String(placement);
      if (!placement) {
        placement = "-";
      } else {
        placement = placement.length==3?placement.substring(0, 1):placement.substring(0,2);
        if (placement.length == 2 && placement.charAt(0) == '1') {
          placement += 'th';
        } else {
          placement += placement.charAt(placement.length - 1)==='1'?'st':placement.charAt(placement.length - 1)==='2'?'nd':placement.charAt(placement.length - 1)==='3'?'rd':'th';
        }
      }
      if (placement.includes('undefined')) placement = "-";

    // Create JSON object to add to cache.
    let body = { 
      'timestamp': timestamp,
      'match_id': req.params.matchid,
      'placement': placement,
      'kills': kills,
      'deaths': deaths,
      'gulag_kills': gulag_kills,
      'gulag_deaths': gulag_deaths,
      'streak': streak,
      'lobby_kd': lobby_kd,
      'game_mode': game_mode,
      'teammates': teammates,
      'user_id': userIds[req.params.userid].acti_id
    };

    mCache[userIds[req.params.userid].acti_id].push(body);

    addStr = `(${timestamp}, '${req.params.matchid}', '${placement}', ${kills}, ${deaths}, ${gulag_kills}, ${gulag_deaths}, ${streak}, ${lobby_kd}, '${JSON.stringify(teammates)}'::json, '${game_mode}', '${userIds[req.params.userid].acti_id}')`;

    let client = await pool.connect();
    await client.query(`INSERT INTO matches(timestamp, match_id, placement, kills, deaths, gulag_kills, gulag_deaths, streak, lobby_kd, teammates, game_mode, user_id) VALUES ${addStr};`);
    client.release();

    response.send(`Match ${req.params.matchid} updated.`);
  } catch (err) {
    console.log(`Add match error: ${err}`);
    response.send(`Add match error.`);
  }
});



// Get user's last match info.
async function lastGame(username) { 
  try {

    // Base values.
    let lastTimestamp = 0;
    let matchNo = 0;

    // If cache is empty, check for matches in database.
    if (!mCache[username].length) {
      let client = await pool.connect();
      let res = await client.query(`SELECT * FROM matches WHERE user_id = '${username}' AND timestamp = (SELECT MAX(timestamp) FROM matches WHERE user_id = '${username}');`);
      mCache[username] = res.rows;
      client.release();
    } 
    
    // If cache is still empty, return.
    if (!mCache[username].length) {
      console.log('No matches found.')
      return 'No matches found.';
    }

    // Get most recent match number and timestamp.
    for (let i = 0; i < mCache[username].length; i++) {
      lastTimestamp = mCache[username][i].timestamp > lastTimestamp?mCache[username][i].timestamp:lastTimestamp;
      matchNo = mCache[username][i].timestamp >= lastTimestamp?i:matchNo;
    }

    // Get match object.
    let match = mCache[username][matchNo];

    // Format teammates, if any.
    let teammates = ' | Teammates: ';
    if (!match.teammates.length) teammates += '-';
    for (let i = 0; i < match.teammates.length; i++) { teammates += (!i?'':' | ') + `${match.teammates[i].name} (${match.teammates[i].kills}K, ${match.teammates[i].deaths}D)`; }
    
    // Return response.
    return `${match.game_mode} | ${match.placement} place | ${decodeURIComponent(username).split('#')[0]} (${match.kills}K, ${match.deaths}D) | Gulag: ${match.gulag_kills?'Won':match.gulag_deaths?'Lost':'-'} ${teammates}`;

  } catch (err) {
    console.log(`Last Game: ${err}`);
    return;
  }
};


// Get user's weekly stats.
async function lastGames(username) {
  try {

    // If cache is empty, check for matches in database.
    if (!mCache[username].length) {
      let client = await pool.connect();
      let res = await client.query(`SELECT * FROM matches WHERE user_id = '${username}';`);
      mCache[username] = res.rows;
      client.release();
    }     

    // Base values.
    let kGame = 0;
    let dGame = 0;
    let wins = 0;
    let streak = 0;
    let gulag_kills = 0;
    let gulag_deaths = 0;

    // Increment stats.
    for (let i = 0; i < mCache[username].length; i++) {
      kGame += mCache[username][i].kills;
      dGame += mCache[username][i].deaths;
      wins += mCache[username][i].placement === "1st"?1:0;
      streak = mCache[username][i].streak > streak?mCache[username][i].streak:streak;
      gulag_kills += mCache[username][i].gulag_kills;
      gulag_deaths += mCache[username][i].gulag_deaths;
    }
    
    // Return response.
    return `Weekly Stats | ${mCache[username].length} Games | Kills/Game: ${mCache[username].length?(kGame/mCache[username].length).toFixed(2):'-'} | Deaths/Game: ${mCache[username].length?(dGame/mCache[username].length).toFixed(2):'-'} | K/D: ${dGame?(kGame/dGame).toFixed(2):'-'} | Wins: ${mCache[username].length?wins:'-'} | Longest Kill Streak: ${mCache[username].length?streak:'-'} | Gulag: ${mCache[username].length?String(gulag_kills) + ' / ' + String(gulag_deaths):'-'}`;

  } catch (err) {
    console.log(`Weekly: ${err}`);
    return;
  }
};


// Get the user's daily stats.
async function daily(username) {
  try {

    // Midnight of current day.
    // @ts-ignore
    let midnight = DateTime.now().setZone('America/Los_Angeles').startOf('day')/1000;

    // If cache is empty, check for matches in database.
    if (!mCache[username].length) {
      let client = await pool.connect();
      let res = await client.query(`SELECT * FROM matches WHERE user_id = '${username}';`);
      mCache[username] = res.rows;
      client.release();
    }  

    // Base values.
    let dailyGames = 0;
    let kGame = 0;
    let dGame = 0;
    let wins = 0;
    let streak = 0;
    let gulag_kills = 0;
    let gulag_deaths = 0;

    // Increment stats.
    for (let i = 0; i < mCache[username].length; i++) {
      if (mCache[username][i].timestamp < midnight) continue;
      dailyGames++;
      kGame += mCache[username][i].kills;
      dGame += mCache[username][i].deaths;
      wins += mCache[username][i].placement === "1st"?1:0;
      streak = mCache[username][i].streak > streak?mCache[username][i].streak:streak;
      gulag_kills += mCache[username][i].gulag_kills;
      gulag_deaths += mCache[username][i].gulag_deaths;
    }

    // Return response.
    return `Daily Stats | Games: ${dailyGames} | Kills/Game: ${dailyGames?(kGame/dailyGames).toFixed(2):'-'} | Deaths/Game: ${dailyGames?(dGame/dailyGames).toFixed(2):'-'} | K/D: ${dGame?(kGame/dGame).toFixed(2):kGame?kGame:'-'} | Wins: ${wins} | Longest Kill Streak: ${streak} | Gulag: ${mCache[username].length?String(gulag_kills) + ' / ' + String(gulag_deaths):'-'}`;

  } catch (err) {
    console.log(`Daily: ${err}`);
    return;
  }
};


// Get the user's 'bombs' for the day (30+ kill games).
async function bombs(username) {
  try {

    // Midnight of current day.
    // @ts-ignore
    let midnight = DateTime.now().setZone('America/Los_Angeles').startOf('day')/1000;

    // If cache is empty, check for matches in database.
    if (!mCache[username].length) {
      let client = await pool.connect();
      let res = await client.query(`SELECT * FROM matches WHERE user_id = '${username}';`);
      mCache[username] = res.rows;
      client.release();
    } 

    // Base object.
    let bombs = [];

    // Increment stats.
    for (let i = 0; i < mCache[username].length; i++) {
      if (mCache[username][i].timestamp < midnight) continue;
      if (mCache[username][i].kills >= 30) bombs.push(mCache[username][i].kills);
    }

    // Return response.
    return `${decodeURIComponent(username).split('#')[0]} has dropped ${bombs.length} bomb${bombs.length==1?'':'s'} (30+ kill games) today ${bombs.length?'('+bombs.join('K, ')+'K)':''}`;

  } catch (err) {
    console.log(`Bombs: ${err}`);
    return;
  }
};


// Get the user's wins for the day.
async function wins(username) {
  try {

    // Midnight of current day.
    // @ts-ignore
    let midnight = DateTime.now().setZone('America/Los_Angeles').startOf('day')/1000;

    // If cache is empty, check for matches in database.
    if (!mCache[username].length) {
      let client = await pool.connect();
      let res = await client.query(`SELECT * FROM matches WHERE user_id = '${username}';`);
      mCache[username] = res.rows;
      client.release();
    } 

    // Base object.
    let wins = [];

    // Increment stats.
    for (let i = 0; i < mCache[username].length; i++) {
      if (mCache[username][i].timestamp < midnight) continue;
      if (mCache[username][i].placement === '1st') wins.push(mCache[username][i].kills);
    }

    // Return response.
    return `${decodeURIComponent(username).split('#')[0]} has won ${wins.length} game${wins.length==1?'':'s'} today ${wins.length?'(' + wins.join('K, ') + 'K)':''}`;

  } catch (err) {
    console.log(`Wins: ${err}`);
    return;
  }
};


// Get user's gulag stats for the day.
async function gulag(username) {
  try {

    // Midnight of current day.
    // @ts-ignore
    let midnight = DateTime.now().setZone('America/Los_Angeles').startOf('day')/1000;

    // If cache is empty, check for matches in the database.
    if (!mCache[username].length) {
      let client = await pool.connect();
      let res = await client.query(`SELECT * FROM matches WHERE user_id = '${username}';`);
      mCache[username] = res.rows;
      client.release();
    }  

    // Base values.
    let gulag_kills = 0;
    let gulag_deaths = 0;

    // Increment stats.
    for (let i = 0; i < mCache[username].length; i++) {
      if (mCache[username][i].timestamp < midnight) continue;
      if (mCache[username][i].gulag_kills) { 
        gulag_kills++;
      } else if (mCache[username][i].gulag_deaths) {
        gulag_deaths++;
      } 
    }

    // Return response.
    return `${decodeURIComponent(username).split('#')[0]} has ${gulag_kills} win${gulag_kills==1?'':'s'} and ${gulag_deaths} loss${gulag_deaths==1?'':'es'} in the gulag today.`;

  } catch (err) {
    console.log(`Gulag: ${err}`);
    return;
  }
};


// Function to get user's frequent teammates.
async function teammates(username) {
  try {
    if (!mCache[username].length) {
      let client = await pool.connect();
      let res = await client.query(`SELECT * FROM matches WHERE user_id = '${username}';`);
      mCache[username] = res.rows;
      client.release();
    }  

    let teammates = new Map();

    for (let i = 0; i < mCache[username].length; i++) {
      let team = mCache[username][i].teammates;
      if (!team.length) continue;

      for (let j = 0; j < team.length; j++) {
        let keyValue = teammates.get(team[j].name);
        teammates.set(team[j].name, keyValue?keyValue + 1:1);
      }
    }
    
    let sorted = Array.from(teammates.keys()).sort((a, b) => teammates.get(b) - teammates.get(a));
    
    let retStr = `Weekly Teammates | `;
    for (let i = 0; i < (sorted.length < 5?sorted.length:5); i++) {
      retStr += `${sorted[i]}: ${teammates.get(sorted[i])} games${i == 4 || i + 1 == sorted.length?'':' | '}`;
    }
    
    return retStr;
  } catch (err) {
    console.log(`Teammates: ${err}`);
    return;
  }
};


// Function to get user's frequent teammates.
async function gamemodes(username) {
  try {
    if (!mCache[username].length) {
      let client = await pool.connect();
      let res = await client.query(`SELECT * FROM matches WHERE user_id = '${username}';`);
      mCache[username] = res.rows;
      client.release();
    }  

    let gamemodes = new Map();

    for (let i = 0; i < mCache[username].length; i++) {
      let mode = mCache[username][i].game_mode;

      let keyValue = gamemodes.get(mode);
      gamemodes.set(mode, keyValue?keyValue + 1:1);
    }
    
    let sorted = Array.from(gamemodes.keys()).sort((a, b) => gamemodes.get(b) - gamemodes.get(a));
    
    let retStr = `Weekly Game Modes | `;
    for (let i = 0; i < (sorted.length < 5?sorted.length:5); i++) {
      retStr += `${sorted[i]}: ${gamemodes.get(sorted[i])} games${i == 4 || i + 1 == sorted.length?'':' | '}`;
    }
    
    return retStr;
  } catch (err) {
    console.log(`Game Modes: ${err}`);
    return;
  }
};


// Pull number of semtex kills from COD API - only for HusK currently.
async function semtex() {
  try {
    let data = await lifetime('HusKerrs, uno');
    let semtex = data.lifetime.itemData.lethals['equip_semtex'].properties.kills;
    return `${semtex} kills with semtex huskKing`;
  } catch (err) {
    console.log(`Semtex: ${err}`);
    return;
  }
};


// Wordle!
app.get('/wordle/:id', async (req, response) => {
  try {
    response.send(await wordle.wordleStart(req.params.id));
  } catch (err) {
    console.log(`Error during Wordle: ${err}`);
    response.send(`Error during Wordle`);
  }
});


// Give up on the Wordle.
app.get('/wordlesux/:id', async (req, response) => {
  try {
    response.send(await wordle.wordleSux(req.params.id));
  } catch (err) {
    console.log(`Error deleting Wordle: ${err}`);
    response.send(`Error during !wordlesux`);
  }
});


// Wordle guess.
app.get('/wordle/:id/:guess', async (req, response) => {
  try {
    response.send(await wordle.wordleGuess(req.params.id, req.params.guess));
  } catch (err) {
    console.log(`Error during Wordle guess: ${err}`);
    response.send(`Error during !wordleguess`);
  }
});


// Wordle past guesses.
app.get('/wordleguesses/:id', async (req, response) => {
  try {
    response.send(await wordle.wordleGuesses(req.params.id));
  } catch (err) {
    console.log(`Error getting past guesses: ${err}`);
    response.send(`Error getting past guesses.`);
  }
});


// Wordle stats.
app.get('/wordlestats/:id', async (req, response) => {
  try {
    response.send(await wordle.wordleStats(req.params.id));
  } catch (err) {
    console.log(`Error while getting Wordle stats: ${err}`);
    response.send(`Error while getting Wordle stats.`);
  }
});


// Wordle leaderboard!
app.get('/wordlelb', async (req, response) => {
  try {
    response.send(await wordle.wordleLb());
  } catch (err) {
    console.log(`Error getting Wordle leaderboard: ${err}`);
    response.send(`Error getting Wordle leaderboard.`);
  }
});


// Pull matches from codtracker between every 5 and store in database.
async function updateMatches() {
  try {
    Object.keys(userIds).forEach((key, i) => {
      setTimeout(async () => {
        try {
          // Get time from a week ago and set base timestamp.
          console.log("Updating matches for " + userIds[key].acti_id);
          // @ts-ignore
          let weekAgo = DateTime.now().minus({weeks:1})/1000;
          let lastTimestamp = 0;
          
          // Clear matches which are older than a week.
          let client = await pool.connect();
          await client.query(`DELETE FROM matches WHERE timestamp < ${weekAgo};`);
          
          // If match cache for this user is empty, set it.
          if (!mCache[userIds[key].acti_id].length) {
            let res = await client.query(`SELECT * FROM matches WHERE user_id = '${userIds[key].acti_id}';`);
            mCache[userIds[key].acti_id] = res.rows;
          }
          
          // Release client.
          client.release();
          
          // Update timestamp of last match.
          for (let i = 0; i < mCache[userIds[key].acti_id].length; i++) {
            lastTimestamp = mCache[userIds[key].acti_id][i].timestamp > lastTimestamp?mCache[userIds[key].acti_id][i].timestamp:lastTimestamp;
          }
          
          // Fetch last 20 matches for user from COD API.
          let data;
          try { 
            data = await last20(userIds[key].acti_id, userIds[key].platform); 
            if (!data) throw new Error('Matches undefined.');
            await update(data.matches, userIds[key], lastTimestamp);
            
            // Get stats for each match and push to database.
            console.log(`Updated matches for ${userIds[key].acti_id}.`);
          }
          catch (err) { setTimeout(async () => { 
            try { 
              console.log(`Error: ${userIds[key].acti_id}, retrying: ${err}`); 
              data = await last20(userIds[key].acti_id, userIds[key].platform); 
              await update(data.matches, userIds[key], lastTimestamp); 

              // Get stats for each match and push to database.
              console.log(`Updated matches for ${userIds[key].acti_id}.`);
            } 
            catch (err) { console.log(`Error during retry: ${err}`) } 
          }, 20000); }

        
        } catch (err) {
          console.log(`Updating matches: ${err}`);
          return; 
        }
      }, i*20000);
    });

  } catch (err) {
    console.log(`${err}: Error while updating matches.`);
  }
};


// Pick the stats out of the matches.
async function update(matches, user, lastTimestamp) {
  try {

    // Declarations and base values.
    let timestamp, match_id, placement, kills, deaths, lobby_kd, game_mode;
    let gulag_kills = 0;
    let gulag_deaths = 0;
    let streak = 0;
    let addStr = [];

    for (let i = 0; i < matches.length; i++) {

      // Lobby KD (broken rn) and timestamp.
      lobby_kd = 0;
      timestamp = matches[i].utcStartSeconds;
      if (timestamp <= lastTimestamp) continue;
      
      // Get match ID.
      match_id = matches[i].matchID;
            
      // Set placement.
      placement = String(matches[i].playerStats.teamPlacement);
      if (!placement) {
        placement = "-";
      } else {
        placement = placement.length==3?placement.substring(0, 1):placement.substring(0,2);
        if (placement.length == 2 && placement.charAt(0) == '1') {
          placement += 'th';
        } else {
          placement += placement.charAt(placement.length - 1)==='1'?'st':placement.charAt(placement.length - 1)==='2'?'nd':placement.charAt(placement.length - 1)==='3'?'rd':'th';
        }
      }
      if (placement.includes('undefined')) placement = "-";
      
      // Set kills and deaths.
      kills = matches[i].playerStats.kills;
      deaths = matches[i].playerStats.deaths;
      
      // Set game mode.
      game_mode = game_modes[matches[i].mode];

      // Set gulag stats.
      gulag_kills = 0;
      gulag_deaths = 0;
      if (!game_mode.includes('Resurgence') && !game_mode.includes('Rebirth')) {
        if (matches[i].playerStats.gulagKills) {
          gulag_kills = 1;
        } else if (matches[i].playerStats.gulagDeaths) {
          gulag_deaths = 1;
        }
      }
      
      // Get all players for this match.
      let players = (await matchInfo(match_id)).allPlayers;
      
      // Find user's team name.
      let teamName;
      for (let j = 0; j < players.length; j++) {
        if (players[j].player.uno === user.uno_id) {
          teamName = players[j].player.team;
          break;
        }
      }
      
      // Teammates?
      let teammates = [];
      for (let j = 0; j < players.length; j++) {
        if (players[j].player.team === teamName && players[j].player.uno !== user.uno_id) {
          let player = { name: players[j].player.username, kills: players[j].playerStats.kills, deaths: players[j].playerStats.deaths };
          teammates.push(player);
          if (teammates.length == 3) break;
        }
      }

      // Replace longest streak?
      streak = matches[i].playerStats.longestStreak;

      // Create JSON object to add to cache.
      let body = { 
        'timestamp': timestamp,
        'match_id': match_id,
        'placement': placement,
        'kills': kills,
        'deaths': deaths,
        'gulag_kills': gulag_kills,
        'gulag_deaths': gulag_deaths,
        'streak': streak,
        'lobby_kd': lobby_kd,
        'game_mode': game_mode,
        'teammates': teammates,
      };

      // Add match stats to cache and prepare them for insertion into the database.
      mCache[user.acti_id].push(body);
      addStr.push(`(${timestamp}, '${match_id}', '${placement}', ${kills}, ${deaths}, ${gulag_kills}, ${gulag_deaths}, ${streak}, ${lobby_kd}, '${JSON.stringify(teammates)}'::json, '${game_mode}', '${user.acti_id}')`);
    }

    // If no new matches, just return.
    if (!addStr.length) return;

    // Insert new matches into database.
    let client = await pool.connect();
    await client.query(`INSERT INTO matches(timestamp, match_id, placement, kills, deaths, gulag_kills, gulag_deaths, streak, lobby_kd, teammates, game_mode, user_id) VALUES ${addStr.join(', ')};`);
    client.release();

  } catch (err) {
    console.log(`${err}: Error in update function.`);
  }
};


// Intervals.
let intervals = [];


// Authenticate with Twitch API.
async function authenticate() {
  try {
    await symAxios.get('https://id.twitch.tv/oauth2/validate')
    .then(async res => {
        intervals.push(setInterval(() => brookescribers(), 120000));
        console.log("Brookescribers");
    })
    .catch(err => {
      if (err.statusCode.includes('40')) {
        regenerate();
      }
      console.log(`Twitch Authenticate: ${err}`);
    })
  } catch (err) {
    console.log(`Overall Twitch Auth: ${err}`); 
  }
}


// Regenerate Twitch API token.
function regenerate() {
  got({
      url: 'https://id.twitch.tv/oauth2/token',
      method: 'POST',
      searchParams: {
          grant_type: 'refresh_token',
          refresh_token: account_config.refresh_token,
          client_id: client_config.client_id,
          client_secret: client_config.client_secret
      },
      responseType: 'json'
  })
  .then(resp => {
      console.log(resp.body);

      for (var k in resp.body) {
          account_config[k] = resp.body[k];
      }

      if (intervals["brooke"]) {
        clearInterval(intervals["brooke"]);
      }

      intervals["brooke"] = setInterval(() => brookescribers(), 120000);
  })
  .catch(err => {
      if (err.response) {
          console.error('Error', err.response.statusCode, err.response.body);
      } else {
          console.error('Error', err);
      }
  });
}


// Function to get accounts which created and followed BrookeAB within 6 hours ago.
async function brookescribers() {
  try {

    // Get Unix timestamp from 6 hours ago.
    // @ts-ignore
    let sixAgo = DateTime.now().setZone('America/Denver').minus({hours:6})/1000;

      // Get BrookeAB's last 20 followers.
      await symAxios.get('https://api.twitch.tv/helix/users/follows?to_id=214560121')
      .then(async resp => {
        try {
          // Pull most recent follower from database.
          let client = await pool.connect();
          await client.query(`DELETE FROM brookescribers WHERE created_at < ${sixAgo};`);
          let fRes = await client.query(`SELECT user_id FROM brookescribers;`);
          let fLast = []
          for (let i = 0; i < fRes.rows.length; i++) fLast.push(fRes.rows[i].user_id);

          // Set up temp storage.
          let temp = resp.data.data;
          let them = [];

          // Iterate through recent followers.
          for (let i = 0; i < temp.length; i++) {

            // If follower is more recent than those in the database and followed within six hours, check it's creation date.
            let followed = (new Date(temp[i].followed_at)).getTime()/1000;
            if (followed > sixAgo) {
              await symAxios.get(`https://api.twitch.tv/helix/users?id=${temp[i].from_id}`)
              .then(res2 => {
                let created = (new Date(res2.data.data[0].created_at)).getTime()/1000;
                if (created > sixAgo && !fLast.includes(res2.data.data[0].login)) them.push(`('${res2.data.data[0].login}', ${followed}, ${created})`);
              })
              .catch(err => {
                console.log(err);
              });
            } else break;
          }

          // Add new followers to database.
          if (them.length) {
            await client.query(`INSERT INTO brookescribers (user_id, followed_at, created_at) VALUES ${them.join(', ')};`);
          }

          // Release client.
          client.release();

          console.log("Updated Brookescribers.");
        } catch (err) {
          console.log(`Brookescribers user: ${err}`);
        }
      })
      .catch(err => {
        console.log(`Brookescribers get user: ${err}`);
      });
  } catch (err) {
    console.log(`Brookescribers overall: ${err}`);
  }
};


// Start'er'up
(async () => {
  try {
    
    // Start server.
    app.listen(process.env.PORT || 6969, function() {
      console.log("Server is listening.");
    });

    // Log into the COD API.
    await loginWithSSO(process.env.COD_SSO);

    // Connect to database.
    let client = await pool.connect();

    // Populate match cache and initialize userIds map.
    let temp = (await client.query(`SELECT * FROM allusers;`)).rows;
    for (let i = 0; i < temp.length; i++) {
      userIds[temp[i].user_id] = temp[i];

      let res = await client.query(`SELECT * FROM matches WHERE user_id = '${temp[i].acti_id}';`);
      mCache[temp[i].acti_id] = res.rows;

      // @ts-ignore
      bot.channels.push(temp[i].user_id);
    };

    // Set the 5 minute interval for each player being tracked and get their active elements.
    intervals["matches"] = setInterval(async() => { 
      try { 
        await updateMatches();
      } catch (err) {
        console.log(`Match intervals: ${err}`);
      }
    }, 300000);

    // Release client.
    client.release();
    
    // Connect to Twitch channels.
    await bot.connect();

    // Authenticate with Twitch API and set 2 minute interval for BrookeAB's followers.
    await authenticate();

  } catch (err) {

    // Close database connection.
    await pool.end();

    // Clear intervals.
    for (let i = 0; i < intervals.length; i++) {
      clearInterval(intervals[i]);
    }

    // Log the error.
    console.log(err);
  }
})();