//@ts-check
// ...
'use strict';
import 'dotenv/config';

// COD API stuff.
import express, { response } from "express";
import uniqid from 'uniqid';
import crypto from 'crypto';

// HTTP utility.
import axios from 'axios';
import got from 'got';

// Twitch and Discord bots.
import tmi, { client } from 'tmi.js';
import { Client, Intents } from "discord.js";

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

// Cooldowns for games.
let rrcd = [], rpscd = [], cfcd = [], bvcd = [], dcd = [];

// Global cooldowns.
let gcd = { };

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
  if (message.channel.id === "775090169417826326") {
    if (message.content.startsWith(prefix)) {
      try {
        message.author.send("HusKerrs' Loadouts (favorite guns at the top): https://www.kittr.gg/channel/HusKerrs/warzone\n"+
        "If you're having trouble accessing the loadout site, please DM @zHekLeR on Twitch or Discord.");
      } catch (err) {
        console.log(err);
      }
    }
	} else if (message.channel.id === "860699279017639936") {
    if (message.content.indexOf('/ban ') >= 0) {
      bot.say('huskerrs', message.content.substring(message.content.indexOf('/ban ')) + ' | Global ban');
    } 
  }
});


// Log in to the Discord bot.
discord.login(process.env.TOKEN);

// HusKerrs VIPs.
const vips = 'neosog, guppii, lululuvely, officialgloriouspcgr, tannerslays, itsthiccchick, craftyjoseph, thanks4dying, mateocrafter1304, hannahnicole4300, stormen, thomdez, fuzwuz, cklaas, triv, zxch, airy_z, bumbobboi, twisttedt, meerko, confire, geesh, missnaruka, gmoe003, femsteph, gdolphn, patriotic, rknhd, rogue_frank, crowder, vileagony, safecojoe, biazar, notjustjohnny, meesterhauns, kurt, midone, muffinwithnobrim, mikedrop39, bronny, swagg, stableronaldo, willo7891, hitstreak, scump, n8brotherwolf, cloakzy, chickitv, karma, soapwingo, joewo, hoffensnieg, deeksjr, tiensochill, gloliva, destroy, its_iron, imr_sa, ochocinco, magalonn, artesianbuilds, azsnakeb1t3, hasham_33, alextumay, pat_o_, nicewigg, 1chilldawg, hideouts_, scummn, momskerrs, p90queen, drawrj, jefedejeff, methodz, valorash_, tyrannymedia, lablakers24, antdavis3, almxnd, jgod_gaming, mafiia_niko, liamferrari, timthetatman, feldubb, holyman, kentb57, l3xu55, bbreadman, sinnerrrr, aydan, unrational, wagnificent, davidtheslayerrr, tommey, zsmit, drakota, mvs_11, ndolok, janegoatt'.split(', ');

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

// Two vs Two arrays.
let tvtInt = {};
let tvtUpdate = {};

// Logs the Twitch bot being initialized.
bot.on('logon', () => {
  console.log("Twitch bot logged on.");
});

// Free trial up.
let pause = {};

// Check for commands and respond appropriately.
bot.on('chat', async (channel, tags, message) => {
  try {

    // Return if not a command.
    if (!message.startsWith('!')) return;
    if (pause[channel.substring(1)] && tags["username"] !== 'zhekler') return;

    // Get command.
    let splits = message.split(' ');
    let short = splits[0].toLowerCase();

    // Is there a global command set for this chat?
    if (!gcd[channel.substring]) {
      gcd[channel.substring(1)] = {};
    }

    // Check/set global cooldown on command.
    if (gcd[channel.substring(1)][short] && gcd[channel.substring(1)][short] > Date.now()) return;
    gcd[channel.substring(1)][short] = Date.now() + 1000;

    // Base values.
    let client, res, placement, kills, multis, score, str;

    // Switch on given command.
    switch (short) {
      // Return commands for this channel.
      case '!commands':
        if (!userIds[channel.substring(1)].commands) break;
        bot.say(channel, `zHekBot commands: https://www.zhekbot.com/commands/${channel.substring(1)}`);
        gcd[channel.substring(1)][short] = Date.now() + 10000;
        break;


      // Pause this shit.
      case '!pause':
        if (tags["username"] !== 'zhekler' || pause[channel.substring(1)]) break;
        pause[channel.substring(1)] = true;
        bot.say(channel, 'The free trial for zHekBot has expired #payzhekler');
        break;

      // Unpause.
      case '!unpause':
        if (tags["username"] !== 'zhekler' || !pause[channel.substring(1)]) break;
        pause[channel.substring(1)] = false;
        break;


      // Enable Revolver Roulette.
      case '!rron': 
        if (userIds[channel.substring(1)].revolverroulette || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET revolverroulette = true WHERE user_id = '${channel.substring(1)}';`)
        client.release();
        userIds[channel.substring(1)].revolverroulette = true;
        bot.say(channel, `Revolver Roulette has been enabled. Type !rr to play!`);
        break;

      // Disable Revolver Roulette.
      case '!rroff': 
        if (!userIds[channel.substring(1)].revolverroulette || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET revolverroulette = false WHERE user_id = '${channel.substring(1)}';`)
        client.release();
        userIds[channel.substring(1)].revolverroulette = false;
        bot.say(channel, `Revolver Roulette has been disabled.`);
        break;

      // Play Revolver Roulette.
      case '!rr': 
        if (!userIds[channel.substring(1)].revolverroulette) break;
        // @ts-ignore
        if (!rrcd[tags["username"]] || rrcd[tags["username"]] < Date.now()) {
          // @ts-ignore
          bot.say(channel, await revolverroulette.revolverroulette(tags["display-name"]?tags["display-name"]:tags["username"], channel));
          // @ts-ignore
          rrcd[tags["username"]] = Date.now() + 30000;
        }
        break;

      // Get this user's Revolver Roulette score.
      case '!rrscore':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        // @ts-ignore
        bot.say(channel, await revolverroulette.revolverrouletteScore(tags["display-name"]?tags["display-name"]:tags["username"], channel));
        break;

      // Get another user's Revolver Roulette score.
      case '!rrscoreother':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        // @ts-ignore
        bot.say(channel, await revolverroulette.revolverrouletteScore(message.split(' ')[1], channel));
        break;

      // Get the 3 users with the top survivals in Revolver Roulette.
      case '!rrlb':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        // @ts-ignore
        bot.say(channel, await revolverroulette.revolverrouletteLb(channel));
        break;

      // Get the 3 users with the top deaths in Revolver Roulette.
      case '!rrlbdie':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        // @ts-ignore
        bot.say(channel, await revolverroulette.revolverrouletteLbDie(channel));
        break;

      // Get the 3 users with the best win / loss ratios in Revolver Roulette.
      case '!rrlbratio':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        // @ts-ignore
        bot.say(channel, await revolverroulette.revolverrouletteLbRatio(channel));
        break;

      // Get the 3 users with the worst win / loss ratios in Revolver Roulette.
      case '!rrlbratiolow':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        // @ts-ignore
        bot.say(channel, await revolverroulette.revolverrouletteLbRatioLow(channel));
        break;

      // Get the total survivals and deaths for this channel in Revolver Roulette.
      case '!rrtotals':
        if (!userIds[channel.substring(1)].revolverroulette) break;
        // @ts-ignore
        bot.say(channel, await revolverroulette.revolverrouletteTotals(channel));
        break;


      // Enable Coinflip.
      case '!coinon':
        if (userIds[channel.substring(1)].coinflip || !tags["mod"] || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET coinflip = true WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].coinflip = true;
        bot.say(channel, `Coinflip enabled.`);
        break;

      // Disable Coinflip.
      case '!coinoff':
        if (!userIds[channel.substring(1)].coinflip || !tags["mod"] || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET coinflip = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].coinflip = false;
        bot.say(channel, `Coinflip disabled.`);
        break;

      // Play Coinflip.
      case '!coin':
        if (!userIds[channel.substring(1)].coinflip) break;
        if (!tags["subscriber"]) break;
        // @ts-ignore
        if (!cfcd[tags["username"]] || cfcd[tags["username"]] < Date.now()) {
          // @ts-ignore
          bot.say(channel, await coinflip.coinflip(tags["display-name"]?tags["display-name"]:tags["username"], message.split(' ')[1], channel));
          // @ts-ignore
          rrcd[tags["username"]] = Date.now() + 15000;
        }
        break;

      // Get this user's score in Coinflip. 
      case '!coinscore':
        if (!userIds[channel.substring(1)].coinflip) break;
        // @ts-ignore
        bot.say(channel, await coinflip.coinflipScore(tags["display-name"]?tags["display-name"]:tags["username"], channel));
        break;

      // Get the users with the most wins and the most losses in Coinflip. 
      case '!coinlb':
        if (!userIds[channel.substring(1)].coinflip) break;
        // @ts-ignore
        bot.say(channel, await coinflip.coinflipLb(channel));
        break;


      // Enable Rock Paper Scissors.
      case '!rpson':
        if (userIds[channel.substring(1)].rps || !tags["mod"] || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET rps = true WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].rps = true;
        bot.say(channel, `Rock paper scissors enabled.`);
        break;

      // Disable Rock Paper Scissors.
      case '!rpsoff':
        if (!userIds[channel.substring(1)].rps || !tags["mod"] || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET rps = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].rps = false;
        bot.say(channel, `Rock paper scissors disabled.`);
        break;

      // Play Rock Paper Scissors.
      case '!rps': 
        if (!userIds[channel.substring(1)].rps) break;
        if (!tags["subscriber"]) break;
        // @ts-ignore
        if (!rpscd[tags["username"]] || rpscd[tags["username"]] < Date.now()) {
          // @ts-ignore
          bot.say(channel, await rps.rps(tags["display-name"]?tags["display-name"]:tags["username"], message.split(' ')[1], channel));
          // @ts-ignore
          rrcd[tags["username"]] = Date.now() + 15000;
        }
        break;

      // Get user's score in Rock Paper Scissors.
      case '!rpsscore': 
      if (!userIds[channel.substring(1)].rps) break;
        // @ts-ignore
        bot.say(channel, await rps.rpsScore(tags["display-name"]?tags["display-name"]:tags["username"], channel));
        break;

      // Get the users with the most wins, most losses, and most ties in Rock Paper Scissors.
      case '!rpslb':
        if (!userIds[channel.substring(1)].rps) break;
        // @ts-ignore
        bot.say(channel, await rps.rpsLb(channel));
        break;


      // Enable Big Vanish. 
      case '!bigvanishon':
        if (userIds[channel.substring(1)].bigvanish || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET bigvanish = true WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].bigvanish = true;
        bot.say(channel, `Bigvanish enabled.`);
        break;

      // Disable Big Vanish.
      case '!bigvanishoff':
        if (!userIds[channel.substring(1)].bigvanish || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET bigvanish = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].bigvanish = false;
        bot.say(channel, `Bigvanish disabled.`);
        break;

      // Play Big Vanish.
      case '!bigvanish':
        if (!userIds[channel.substring(1)].bigvanish) break;
        // @ts-ignore
        if (!bvcd[tags["username"]] || bvcd[tags["username"]] < Date.now()) {
          // @ts-ignore
          bot.say(channel, await bigvanish.bigVanish(tags["display-name"]?tags["display-name"]:tags["username"], channel));
          // @ts-ignore
          rrcd[tags["username"]] = Date.now() + 15000;
          setTimeout(function() { bot.say(channel, `/untimeout ${tags["username"]}`); }, 3000);
        }
        break;

      // Get the 3 users with the highest timeouts in Big Vanish.
      case '!bigvanishlb':
        if (!userIds[channel.substring(1)].bigvanish) break;
        // @ts-ignore
        bot.say(channel, await bigvanish.bigVanishLb(channel));
        break;

      // Get the 3 users with the lowest timeouts in Big Vanish.
      case '!bigvanishlow':
        if (!userIds[channel.substring(1)].bigvanish) break;
        // @ts-ignore
        bot.say(channel, await bigvanish.bigVanishLow(channel));
        break;

      
      // Enable customs scoring.
      case '!customon':
        if (userIds[channel.substring(1)].customs || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        if (channel.substring(1) === 'huskerrs') {
          bot.say(channel, '!enable !score false');
          bot.say(channel, '!enable !mc false');
        }
        client = await pool.connect();
        await client.query(`UPDATE allusers SET customs = true WHERE user_id = '${channel.substring(1)}';`)
        client.release();
        userIds[channel.substring(1)].customs = true;
        break;

      // Disable customs scoring.
      case '!customoff':
        if (!userIds[channel.substring(1)].customs || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;;
        if (channel.substring(1) === 'huskerrs') {
          bot.say(channel, '!enable !score true');
          bot.say(channel, '!enable !mc true');
        }
        client = await pool.connect();
        await client.query(`UPDATE allusers SET customs = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].customs = false;
        break;

      // Set the number of maps.
      case '!setmaps': 
        if (!userIds[channel.substring(1)].customs || (!tags["mod"] && tags['username'] !== channel.substring(1)) || splits.length == 1) break;
        client = await pool.connect();
        await client.query(`UPDATE customs SET map_count = ${parseInt(splits[1])} WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        bot.say(channel, `Map count has been set to ${splits[1]}`);
        break;

      // Set the placement string.
      case '!setplacement':
        if (!userIds[channel.substring(1)].customs || (!tags["mod"] && tags['username'] !== channel.substring(1)) || splits.length % 2 != 1) break;
        client = await pool.connect();
        await client.query(`UPDATE customs SET multipliers = '${message.substring(message.indexOf(' ') + 1)}' WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        bot.say(channel, `Placement multipliers have been updated.`);
        break;

      // Add a map to the scores.
      case '!addmap':
        if (!userIds[channel.substring(1)].customs || (!tags["mod"] && tags['username'] !== channel.substring(1)) || splits.length != 3) break;
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
        await client.query(`UPDATE customs SET maps = '${JSON.stringify(res.rows[0].maps)}'::json WHERE user_id = '${channel.substring(1)}';`);
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
        // @ts-ignore
        bot.say(channel, `Team ${channel.substring(1)} got ${placement} place with ${kills} kills for ${score.toFixed(2)} points!`);
        break;

      // Remove the last map from the scores.
      case '!removemap':
        if (!userIds[channel.substring(1)].customs || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM customs WHERE user_id = '${channel.substring(1)}';`);
        res.rows[0].maps.placement.length = res.rows[0].maps.placement.length?res.rows[0].maps.placement.length-1:0;
        res.rows[0].maps.kills.length = res.rows[0].maps.kills.length?res.rows[0].maps.kills.length-1:0;
        await client.query(`UPDATE customs SET maps = '{"placement":${res.rows[0].maps.placement.length?'['+res.rows[0].maps.placement.join(',')+']':'[]'},"kills":${res.rows[0].maps.kills.length ?'['+res.rows[0].maps.kills.join(',')+']':'[]'}}'::json WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        bot.say(channel, `Last map has been removed.`);
        break;

      // Get the map count.
      case '!mc':
        if (!userIds[channel.substring(1)].customs) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM customs WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        if (res.rows[0].maps.placement.length == res.rows[0].map_count) {
          str = `All maps have been played.`;
        } else {
          str = `Map ${res.rows[0].maps.placement.length + 1} of ${res.rows[0].map_count}`;
        }
        bot.say(channel, str);
        break;

      // Get the score for the maps thus far.
      case '!score':
        if (!userIds[channel.substring(1)].customs && !userIds[channel.substring(1)].two_v_two) break;
        if (userIds[channel.substring(1)].customs) {
          client = await pool.connect();
          res = await client.query(`SELECT * FROM customs WHERE user_id = '${channel.substring(1)}';`);
          client.release();
          score = [];
          let total = 0;
          multis = res.rows[0].multipliers.split(' ');
          for (let i = 0; i < res.rows[0].maps.placement.length; i++) {
            for (let j = multis.length/2; j >= 0; j--) {
              if (parseInt(res.rows[0].maps.placement[i]) >= parseInt(multis[2*j])) {
                placement = parseFloat(multis[(2*j)+1]);
                break;
              }
            }
            // @ts-ignore
            score.push(`Map ${i + 1}: ${(res.rows[0].maps.kills[i] * placement).toFixed(2)}`);
            // @ts-ignore
            total += res.rows[0].maps.kills[i] * placement;
          }
          str = score.join(' | ');
          if (score.length < res.rows[0].map_count) str += score.length?` | Map ${score.length + 1}: TBD`:`Map 1: TBD`;
          str += ` | Total: ${total.toFixed(2)} pts`;
          bot.say(channel, str);
        } else if (userIds[channel.substring(1)]["two_v_two"]) {
          await tvtscores(channel.substring(1));
        }
        break;

      // Clear all of the maps.
      case '!resetmaps':
        if (!userIds[channel.substring(1)].customs || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE customs SET maps = '{"placement":[],"kills":[]}'::json WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        bot.say(channel, `Maps have been reset.`);
        break;


      // Enable match tracking.
      case '!matcheson':
        if (userIds[channel.substring(1)].matches || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        if (!userIds[channel.substring(1)].acti_id) {
          bot.say(channel, `You must first set your Activision ID in the dashboard.`);
          break;
        }
        client = await pool.connect();
        await client.query(`UPDATE allusers SET matches = true WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].matches = true;
        bot.say(channel, `Matches disabled.`);
        break;

      // Disable match tracking.
      case '!matchesoff':
        if (!userIds[channel.substring(1)].matches || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET matches = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].matches = false;
        bot.say(channel, `Matches enabled.`);
        break;

      // Get the last game stats.
      case '!lastgame':
        if (!userIds[channel.substring(1)].matches) break;
        // @ts-ignore
        bot.say(channel, await lastGame(channel.substring(1)));
        break;

      // Get the weekly stats.
      case '!lastgames':
      case '!weekly':
        if (!userIds[channel.substring(1)].matches) break;
        // @ts-ignore
        bot.say(channel, await lastGames(userIds[channel.substring(1)].acti_id));
        break;

      // Get the daily stats.
      case '!daily':
        if (!userIds[channel.substring(1)].matches) break;
        // @ts-ignore
        bot.say(channel, await daily(channel.substring(1)));
        break;

      // Get the daily bombs.
      case '!bombs':
        if (!userIds[channel.substring(1)].matches || channel.substring(1) === 'fifakillvizualz') break;
        // @ts-ignore
        bot.say(channel, await bombs(channel.substring(1)));
        break;

      // Get the daily wins.
      case '!wins': 
      if (!userIds[channel.substring(1)].matches) break;
        // @ts-ignore
        bot.say(channel, await wins(channel.substring(1)));
        break;

      // Get the daily gulag record.
      case '!gulag':
        if (!userIds[channel.substring(1)].matches) break;
        // @ts-ignore
        bot.say(channel, await gulag(channel.substring(1)));
        break;

      // Get lifetime stats.
      case '!stats':
      case '!kd':
        if (!userIds[channel.substring(1)].matches) break;
        bot.say(channel, await stats(userIds[channel.substring(1)].acti_id, userIds[channel.substring(1)].platform));
        break;

      // Get number of semtex kills.
      case '!kobe':
      case '!semtex':
        if (channel.substring(1) !== 'huskerrs') break;
        // @ts-ignore
        bot.say(channel, await semtex());
        break;

      // Get the 5 most frequent teammates this week.
      case '!teammates':
        if (!userIds[channel.substring(1)].matches) break;
        // @ts-ignore
        bot.say(channel, await teammates(userIds[channel.substring(1)].acti_id));
        break;

      // Get the 5 most frequent game modes this week.
      case '!modes':
      case '!gamemodes':
        if (!userIds[channel.substring(1)].matches) break;
        // @ts-ignore
        bot.say(channel, await gamemodes(userIds[channel.substring(1)].acti_id));
        break;
      

      // Enable Two vs Two scoring.
      case '!2v2on':
        if (userIds[channel.substring(1)]["two_v_two"] || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        if (channel.substring(1) === 'huskerrs') {
          bot.say(channel, '!enable !score false');
          bot.say(channel, `HusKerrs' official scorekeeper is esSpyderMonkey. Make sure to thank him for the updates!`);
        } else {
          bot.say(channel, 'Score recording enabled.');
        }
        client = await pool.connect();
        await client.query(`UPDATE allusers SET two_v_two = true WHERE user_id = '${channel.substring(1)}';`);
        let rows = await client.query(`SELECT * FROM twovtwo WHERE userid = '${channel.substring(1)}';`);
        if (rows.rows.length) {
          await client.query(`UPDATE twovtwo SET hkills = 0, tkills = 0, o1kills = 0, o2kills = 0 WHERE userid = '${channel.substring(1)}';`);
        } else {
          await client.query(`INSERT INTO twovtwo(hkills, tkills, o1kills, o2kills, userid) VALUES (0, 0, 0, 0, '${channel.substring(1)}');`)
        }
        client.release();
        userIds[channel.substring(1)]["two_v_two"] = true;
        tvtInt[channel.substring(1)] = setInterval(function() {tvtscores(channel.substring(1))}, 30000);
        tvtUpdate[channel.substring(1)] = Date.now();
        break;

      // Disable Two vs Two scoring.
      case '!2v2off':
        if (!userIds[channel.substring(1)]["two_v_two"] || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;;
        if (channel.substring(1) === 'huskerrs') {
          bot.say(channel, '!enable !score true');
        } else {
          bot.say(channel, 'Score recording disabled.');
        }
        client = await pool.connect();
        await client.query(`UPDATE allusers SET two_v_two = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)]["two_v_two"] = false;
        clearInterval(tvtInt[channel.substring(1)]);
        delete tvtInt[channel.substring(1)];
        delete tvtUpdate[channel.substring(1)];
        tvtInt = [];
        break;
      

      // Enable sub thanking.
      case '!subson':
        if (tags['username'] !== 'zhekler' && tags['username'] !== channel.substring(1)) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET subs = true WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].subs = true;
        break;

      // Disable sub thanking.
      case '!subsoff':
        if (tags['username'] !== 'zhekler' && tags['username'] !== channel.substring(1)) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET subs = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].subs = false;
        break;
      

      // Check the stats of a user.
      case '!check':
        // @ts-ignore
        if (!tags['mod'] && !vips.includes(tags['username']) && channel.substring(1) !== tags["username"]) break;
        bot.say(channel, await stats(message.substring(message.indexOf(' ') + 1), 'uno'));
        break;


      // Announce prediction to chat.
      case '!pred':
        if (channel.substring(1) !== 'huskerrs' || !tags["mod"]) break;
        str = `PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk PREDICTION peepoGamble  DinkDonk `;
        bot.say(channel, `/announce ${str}`);
        bot.say(channel, `/announce ${str}`);
        bot.say(channel, `/announcegreen ${str}`);
        break;


      // Timeout command for VIPs mainly.
      case '!timeout':
        // @ts-ignore
        if (channel.substring(1) !== 'huskerrs' || (!tags["mod"] && !vips.includes(tags['username']))) break;
        bot.say(channel, `/timeout ${message.substring(message.indexOf(' ') + 1)} - ${tags['username']}`);
        break;

      // Untimeout command for VIPs mainly.
      case '!untimeout':
        // @ts-ignore
        if (channel.substring(1) !== 'huskerrs' || (!tags["mod"] && !vips.includes(tags['username']))) break;
        bot.say(channel, `/untimeout ${splits[1]}`);
        break;

      // Ban command for VIPs mainly.
      case '!ban':
        // @ts-ignore
        if (channel.substring(1) !== 'huskerrs' || (!tags["mod"] && !vips.includes(tags['username']))) break;
        bot.say(channel, `/ban ${message.substring(message.indexOf(' ') + 1)} - ${tags['username']}`);
        break;

      // Unban command for VIPs mainly.
      case '!unban':
        // @ts-ignore
        if (channel.substring(1) !== 'huskerrs' || (!tags["mod"] && !vips.includes(tags['username']))) break;
        bot.say(channel, `/unban ${splits[1]}`);
        break;

      
      // Enable dueling.
      case '!duelon':
        if (userIds[channel.substring(1)].duel || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET duel = true WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].duel = true;
        bot.say(channel, 'Duels are now enabled.');
        break;

      // Disable dueling.
      case '!dueloff':
        if (!userIds[channel.substring(1)].duel || (!tags["mod"] && tags['username'] !== channel.substring(1))) break;
        client = await pool.connect();
        await client.query(`UPDATE allusers SET duel = false WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        userIds[channel.substring(1)].duel = false;
        bot.say(channel, 'Duels are now disabled.');
        break;
      
      // Challenge another user to a duel.
      case '!duel': 
        if (!userIds[channel.substring(1)].duel || splits.length == 1) break;
        // @ts-ignore
        if (dcd[tags["username"]] && dcd[tags["username"]] > Date.now()) break;

        splits[1] = splits[1].indexOf('@') === 0?splits[1].substring(1):splits[1];
        if (tags["username"] === splits[1].toLowerCase()) {
          bot.say(channel, `@${tags["username"]} : You cannot duel yourself.`);
          break;
        }

        client = await pool.connect();
        res = await client.query(`SELECT * FROM duelduel WHERE oppid = '${splits[1].toLowerCase()}' AND stream = '${channel.substring(1)}';`);
        let res2 = await client.query(`SELECT * FROM duelduel WHERE userid = '${splits[1].toLowerCase()}' AND stream = '${channel.substring(1)}';`);

        if (!res.rows.length && (!res2.rows.length || res2.rows[0].oppid === ' ')) {
          let res3 = await client.query(`SELECT * FROM duelduel WHERE userid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);

          if (res3.rows.length) {

            if (!res3.rows[0].oppid || res3.rows[0].oppid === ' ') {
              await client.query(`UPDATE duelduel SET oppid = '${splits[1].toLowerCase()}', expiration = ${Date.now()/1000 + 120} WHERE userid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
              bot.say(channel, `@${splits[1].toLowerCase()} : You've been challenged to a duel by ${tags["username"]}! Type !accept to accept or !coward to deny. Loser is timed out for 1 minute.`);
              // @ts-ignore
              dcd[tags["username"]] = Date.now() + 15000;
            } else {
              bot.say(channel, `@${tags["username"]} : You have already challenged someone to a duel. Type !cancel to cancel it.`);
            }
          } else {
            await client.query(`INSERT INTO duelduel(oppid, expiration, userid, stream) VALUES ('${splits[1].toLowerCase()}', ${Date.now()/1000 + 120}, '${tags["username"]}', '${channel.substring(1)}');`);
            bot.say(channel, `@${splits[1].toLowerCase()} : You've been challenged to a duel by ${tags["username"]}! Type !accept to accept or !coward to deny. Loser is timed out for 1 minute.`);
            // @ts-ignore
            dcd[tags["username"]] = Date.now() + 15000;
          }
        } else {
          bot.say(channel, `@${tags["username"]} : This person has already challenged someone / been challenged.`);
        }
        client.release();
        break;

      // Cancel a duel challenge.
      case '!cancel': 
        if (!userIds[channel.substring(1)].duel) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM duelduel WHERE userid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
        if (res.rows.length && res.rows[0].oppid !== ' ') {
          await client.query(`UPDATE duelduel SET oppid = ' ', expiration = 2147483647 WHERE userid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
          bot.say(channel, `@${tags["username"]} : You have cancelled the duel.`);
        }
        client.release();
        break;

      // Reject another user's challenge.
      case '!coward': 
        if (!userIds[channel.substring(1)].duel) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM duelduel WHERE oppid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
        if (res.rows.length) {
          await client.query(`UPDATE duelduel SET oppid = ' ', expiration = 2147483647 WHERE oppid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
          bot.say(channel, `/announce ${tags["username"]} has rejected the duel KEKWiggle`)
        } 
        client.release();
        break;

      // Accept another user's challenge.
      case '!accept': 
        if (!userIds[channel.substring(1)].duel) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM duelduel WHERE oppid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
        if (res.rows.length) {
          let rand = Math.round(Math.random());
          if (rand) {
            await client.query(`UPDATE duelduel SET oppid = ' ', expiration = 2147483647, wins = wins + 1 WHERE userid = '${res.rows[0].userid}' AND stream = '${channel.substring(1)}';`);
            let res2 = await client.query(`SELECT * FROM duelduel WHERE userid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
            if (res2.rows.length) {
              await client.query(`UPDATE duelduel SET losses = losses + 1 WHERE userid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
            } else {
              await client.query(`INSERT INTO duelduel(userid, losses, stream) VALUES ('${tags["username"]}', 1, '${channel.substring(1)}');`);
            }
            bot.say(channel, `/timeout ${tags["username"]} 60 You lost the duel to ${res.rows[0].userid}. Hold this L`);
            bot.say(channel, `${res.rows[0].userid} has won the duel against ${tags["username"]}!`);
          } else {
            let res2 = await client.query(`SELECT * FROM duelduel WHERE userid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
            if (res2.rows.length) {
              await client.query(`UPDATE duelduel SET wins = wins + 1 WHERE userid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
            } else {
              await client.query(`INSERT INTO duelduel(userid, wins, stream) VALUES ('${tags["username"]}', 1, '${channel.substring(1)}');`);
            }
            await client.query(`UPDATE duelduel SET oppid = ' ', expiration = 2147483647, losses = losses + 1 WHERE userid = '${res.rows[0].userid}' AND stream = '${channel.substring(1)}';`);
            bot.say(channel, `/timeout ${res.rows[0].userid} 60 You lost the duel to ${tags["username"]}. Hold this L`);
            await bot.say(channel, `${tags["username"]} has won the duel against ${res.rows[0].userid}!`);
          }
        }
        client.release();
        break;

      // Get user's duel score.
      case '!duelscore':
        if (!userIds[channel.substring(1)].duel) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM duelduel WHERE userid = '${tags["username"]}' AND stream = '${channel.substring(1)}';`);
        client.release();
        if (res.rows.length && (res.rows[0].wins || res.rows[0].losses)) {
          bot.say(channel, `${tags["username"]} has won ${res.rows[0].wins} duels and lost ${res.rows[0].losses}. That is a ${(100*res.rows[0].wins/(res.rows[0].wins+res.rows[0].losses)).toFixed(2)}% win rate.`);
        } else {
          bot.say(channel, `${tags["username"]} has not dueled anyone.`);
        }
        break;

      // Get another user's duel score.
      case '!duelscoreother':
        if (!userIds[channel.substring(1)].duel || !splits[1]) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM duelduel WHERE userid = '${splits[1].toLowerCase()}' AND stream = '${channel.substring(1)}';`);
        client.release();
        if (res.rows.length && (res.rows[0].wins || res.rows[0].losses)) {
          bot.say(channel, `${splits[1]} has won ${res.rows[0].wins} duels and lost ${res.rows[0].losses}. That is a ${(100*res.rows[0].wins/(res.rows[0].wins+res.rows[0].losses)).toFixed(2)}% win rate.`);
        } else {
          bot.say(channel, `${splits[1]} has not dueled anyone.`);
        }
        break;

      // Get the 3 users with the most dueling wins.
      case '!duellb':
        if (!userIds[channel.substring(1)].duel) break;
        client = await pool.connect();
        res = await client.query(`SELECT * FROM duelduel WHERE stream = '${channel.substring(1)}' ORDER BY wins DESC LIMIT 3;`);
        client.release();
        str = [];
        for (let i = 0; i < res.rows.length; i++) {
          str.push(`${res.rows[i].userid}: ${res.rows[i].wins}`);
        }
        bot.say(channel, `Duel Leaderboard: Wins | ${str.join(' | ')}`);
        break;

      // Get the 3 users with the best win / loss ratio in duels.
      case '!duellbratio':
        if (!userIds[channel.substring(1)].duel) break;
        client = await pool.connect();
        res = await client.query(`SELECT userid, wins, losses, ROUND(wins * 100.0 / (wins + losses), 2) AS percent FROM (SELECT * FROM duelduel WHERE wins + losses >= 10 AND stream = '${channel.substring(1)}') AS rr ORDER BY percent DESC LIMIT 3;`);
        client.release();
        str = [];
        for (let i = 0; i < res.rows.length; i++) {
          str.push(`${res.rows[i].userid}: ${res.rows[i].percent}% (${res.rows[i].wins + res.rows[i].losses})`);
        }
        bot.say(channel, `Duel Leaderboard: Ratio | ${str.join(' | ')}`);
        break;

      // Get the 3 users with the worst win / loss ratio in duels.
      case '!duellbratiolow':
        if (!userIds[channel.substring(1)].duel) break;
        client = await pool.connect();
        res = await client.query(`SELECT userid, wins, losses, ROUND(wins * 100.0 / (wins + losses), 2) AS percent FROM (SELECT * FROM duelduel WHERE wins + losses >= 10 AND stream = '${channel.substring(1)}') AS rr ORDER BY percent ASC LIMIT 3;`);
        client.release();
        str = [];
        for (let i = 0; i < res.rows.length; i++) {
          str.push(`${res.rows[i].userid}: ${res.rows[i].percent}% (${res.rows[i].wins + res.rows[i].losses})`);
        }
        bot.say(channel, `Duel Leaderboard: Ratio | ${str.join(' | ')}`);
        break;

      
      // Exit the channel.
      case '!zhekleave':
        if (tags["username"] !== channel.substring(1) && tags["username"] !== "zhekler") break;
        delete userIds[channel.substring(1)];
        client = await pool.connect();
        await client.query(`DELETE FROM allusers WHERE user_id = '${channel.substring(1)}';`);
        client.release();
        bot.say(channel, 'peepoLeave');
        bot.part(channel);
        break;

    }
  } catch (err) {
    console.log(`Twitch bot commands: ${err}`);
  }
});


// Two vs Two scores.
async function tvtscores(channel, force = false) {
  try {
    if (force || tvtUpdate[channel] < Date.now()) {
      let client = await pool.connect();
      let res = await client.query(`SELECT * FROM twovtwo WHERE userid = '${channel}';`);
      client.release();
      let us = res.rows[0].hkills + res.rows[0].tkills;
      let opp = res.rows[0].o1kills + res.rows[0].o2kills;
      bot.say(channel, `${us} - ${opp}${(us==6 && opp==9)?` Nice`:``} | ${us + res.rows[0].mapreset > opp?"Up "+ (us + res.rows[0].mapreset - opp):us + res.rows[0].mapreset < opp?"Down " + (opp - us - res.rows[0].mapreset):"Tied"}
        ${res.rows[0].mapreset != 0?(res.rows[0].mapreset > 0?' (Up ':' (Down ') + Math.abs(res.rows[0].mapreset) + ' after reset)':''}`);
      tvtUpdate[channel] = Date.now() + 5000;
    }
  } catch (err) {
    console.log(`Error during tvtscores: ${err}`);
  }
} 


// Remove expired challenges.
async function duelExpiration() {
  try {
    let client = await pool.connect();
    await client.query(`UPDATE duelduel SET oppid = ' ', expiration = 2147483647 WHERE expiration < ${Date.now()/1000};`);
    client.release();
  } catch (err) {
    console.log(err);
  }
}


// Twitch bot subscription handler.
// @ts-ignore
bot.on('subscription', (channel, username, method, message, userstate) => {
  if (!userIds[channel.substring(1)].subs) return;
  bot.say(channel, `${username} Thank you for the sub, welcome to the Huskies huskHype huskLove`);
});


// Twitch bot resubscription handler.
// @ts-ignore
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
  'br_dmz_playlist_wz325/rbrthbmo_solos': 'Rebirth Reinforced Solos',
  'br_dbd_playlist_wz330/cal_iron_quads': 'Caldera Iron Trial Quads',
  'br_dbd_playlist_wz330/cal_iron_trios': 'Caldera Iron Trial Trios',
  'br_dbd_playlist_wz330/cal_iron_duos': 'Caldera Iron Trial Duos',
  'br_dbd_playlist_wz330/cal_iron_solos': 'Caldera Iron Trial Solos',
  'br_mendota_playlist_wz330': 'Operation Monarch',
  'br_mendota_playlist_wz330/op_mon': 'Monarch Quads',
  'br_respect_playlist_wz335/respect': 'Champion of Caldera',
  'br_rebirth_playlist_wz325/afd_resurgence': 'Totally Normal Rebirth',
  'br_playlist_wz335/rebirthexfilttrios': 'Rebirth Exfil Trios'
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
      // @ts-ignore
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
                      case 'Not permitted: not allowed':
                          return apiErrorMessage;
                      case 'Error from datastore':
                          return '500 - Internal server error. Request failed, try again.';
                      default:
                          return apiErrorMessage;
                  }
                  // @ts-ignore
                  break;
              case 401:
                  return '401 - Unauthorized. Incorrect username or password.';
              case 403:
                  return '403 - Forbidden. You may have been IP banned. Try again in a few minutes.';
              case 404:
                  return 'Account is set to private.';
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
      // @ts-ignore
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

import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import favicon from 'serve-favicon';
import Profanity from 'profanity-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const jsonParser = bodyParser.json();
const profanity = new Profanity();

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'node_modules')));
app.use(cookieParser());
app.use(favicon(path.join(__dirname, 'favicon.ico')));


// Home page.
app.get('/', async (request, response) => {
  let cookies = request.cookies;
  let page;
  if (cookies["auth"]) {
    await got('https://id.twitch.tv/oauth2/validate', {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cookies["auth"]}`
      }
    }).then(async res => {
      if (res.statusCode === 200) {
        let client = await pool.connect();
        let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
        client.release();

        if (rows.length) {
          page = fs.readFileSync('./html/page.html').toString('utf-8');
          page = page.replace(/#pref_name#/g, userIds[rows[0].userid].pref_name)
          page = page.replace(/#channel#/g, userIds[rows[0].userid].user_id);
          page = page.replace(/#editors#/g, `<a href="/editors/${rows[0].userid}"><div class="button">Manage your Editors</div></a><br>`);
          page = page.replace(/#checked#/g, userIds[rows[0].userid].twitch?'checked':'');
          page = page.replace('Login to Twitch', 'Logout of Twitch');
          let perms = rows[0]&&rows[0].perms?rows[0].perms.split(','):'';
          if (!perms.length) {
            page = page.replace(/#Permissions#/g, '');
          } else {
            let str = '<h3>Permissions:</h3>';
            for (let i = 0; i < perms.length; i++) {
              str += `<a href="/edit/${perms[i]}"><div class="button">${userIds[perms[i]].pref_name}</div></a>`;
            }
            page = page.replace(/#Permissions#/g, str);
          }
        } else {
          response.redirect('/login');
          return;
        }
        response.send(page); 
      } else {
        page = fs.readFileSync('./html/not_enabled.html').toString('utf-8');
        page = page.replace(/#Placeholder#/g, `<a href="/login"><div class="button">It looks like you haven't logged in with Twitch yet. Click here to do that.</div></a>`);
        response.send(page); 
      }
    }).catch(err => {
      console.log(err);
      response.send(err);
      return;
    });

  } else {
    page = fs.readFileSync('./html/not_enabled.html').toString('utf-8');
    page = page.replace(/#Placeholder#/g, `<a href="/login"><div class="button">It looks like you haven't logged in with Twitch yet. Click here to do that.</div></a>`);
    response.send(page); 
  }
});


// Enable/disable.
app.get('/enable/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel]) {
      response.sendStatus(404);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    userIds[request.params.channel].twitch = !userIds[request.params.channel].twitch;

    client = await pool.connect();
    await client.query(`UPDATE allusers SET twitch = ${userIds[request.params.channel].twitch} WHERE user_id = '${request.params.channel}';`);
    client.release();

    if (userIds[request.params.channel].twitch) {
      bot.join(request.params.channel);
    } else {
      bot.part(request.params.channel);
    }

    response.sendStatus(200);
  } catch (err) {
    console.log(err);
    response.sendStatus(500);
  }

});


// Page for other user.
app.get('/edit/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel]) {
      response.status(404);
      response.redirect('/');
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.status(401);
        response.redirect('/');
        return;
      }
    } else {
      response.status(401);
      response.redirect('/');
      return;
    }

    await got('https://id.twitch.tv/oauth2/validate', {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${cookies['auth']}`
      }
    }).then(async res => {
      if (res.statusCode === 200) {
        client = await pool.connect();
        let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies['auth']}';`)).rows;
        client.release();

        if (rows.length && rows[0].perms.split(',').includes(request.params.channel.toLowerCase())) {
          let page = fs.readFileSync('./html/page.html').toString('utf-8');
          page = page.replace(/#pref_name#/g, userIds[request.params.channel.toLowerCase()].pref_name);
          page = page.replace(/#channel#/g, userIds[request.params.channel.toLowerCase()].user_id);
          page = page.replace(/#Permissions#/g, '');
          page = page.replace(/#editors#/g, '');
          page = page.replace(/#checked#/g, userIds[request.params.channel.toLowerCase()].twitch?'checked':'');
          page = page.replace(/Login to Twitch/g, 'Logout of Twitch');

          response.send(page);
        } else {
          response.status(403);
          response.redirect('/');
        }
      } else {
        response.status(403);
        response.redirect('/');
      }
    }).catch(err => {
      console.log(err);
      response.status(500);
      response.redirect('/');
    })
  } catch (err) {
    console.log(err);
    response.status(500);
    response.redirect('/');
  }
});


// Commands page.
app.get('/commands/:channel', (request, response) => {
  let comPage;
  if (Object.keys(userIds).includes(request.params.channel.toLowerCase())) {
    comPage = fs.readFileSync("./html/commands.html").toString('utf-8');
    comPage = comPage.replace(/#Placeholder#/g, userIds[request.params.channel.toLowerCase()]["pref_name"]);
    comPage = comPage.replace('let tabsEnabled = {};', `let tabsEnabled = {
      'Warzone Stats / Matches': ${userIds[request.params.channel.toLowerCase()].matches},
      'Revolver Roulette': ${userIds[request.params.channel.toLowerCase()].revolverroulette},
      'Coinflip': ${userIds[request.params.channel.toLowerCase()].coinflip},
      'Rock Paper Scissors': ${userIds[request.params.channel.toLowerCase()].rps},
      'Big Vanish': ${userIds[request.params.channel.toLowerCase()].bigvanish},
      'Custom Tourney': ${userIds[request.params.channel.toLowerCase()].customs},
      'Two vs Two': ${userIds[request.params.channel.toLowerCase()]["two_v_two"]},
      'Duels': ${userIds[request.params.channel.toLowerCase()].duel}
    };`);
  } else {
    response.status(404);
    comPage = fs.readFileSync("./html/not_found.html").toString('utf-8');
  }
  let cookies = request.cookies;
  if (cookies["auth"]) {
    comPage = comPage.replace('Login to Twitch', 'Logout of Twitch');
  }
  response.send(comPage);
});


// Editors.
app.get('/editors/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel]) {
      response.sendStatus(404);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || rows[0].userid !== request.params.channel.toLowerCase()) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    let page = fs.readFileSync('./html/editors.html').toString('utf-8');

    client = await pool.connect();
    let rows = (await client.query(`SELECT * FROM permissions WHERE perms LIKE '%${request.params.channel}%';`)).rows;
    client.release();

    let str = '';
    for (let i = 0; i < rows.length; i++) {
      let perms = rows[i].perms.split(',');
      if (perms.includes(request.params.channel)) {
        str += `<tr><th>${rows[0].userid}</th><th><div class="button" onclick="remove(this)">Remove</div></th></tr>`;
      }
    }
    page = page.replace(/#editors#/g, str);
    page = page.replace(/#pref_name#/g, userIds[request.params.channel].pref_name);
    page = page.replace(/#channel#/g, userIds[request.params.channel].user_id);

    response.send(page);
  } catch (err) {
    console.log(err);
    response.sendStatus(500);
  }
});


// Add editor.
app.get('/addeditor/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel] || !request.get('editor')) {
      response.sendStatus(404);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || rows[0].userid !== request.params.channel.toLowerCase()) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    client = await pool.connect();
    let rows = (await client.query(`SELECT * FROM permissions WHERE userid = '${request.get('editor')}';`)).rows;
    if (!rows.length) {
      await client.query(`INSERT INTO permissions(userid, perms) VALUES ('${request.get('editor')}', '${request.params.channel}')`);
    } else if (!rows[0].perms.split(',').includes(request.params.channel)) {
      await client.query(`UPDATE permissions SET perms = perms || ',${request.params.channel}' WHERE userid = '${request.get('editor')}';`);
    }
    client.release();

    response.sendStatus(200);
  } catch (err) {
    console.log(err);
    response.sendStatus(500);
  }
});


// Remove editor.
app.get('/removeeditor/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel]) {
      response.sendStatus(404);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || rows[0].userid !== request.params.channel) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    if (!request.get('editor')) {
      response.sendStatus(404);
      return;
    }

    client = await pool.connect();
    let rows = (await client.query(`SELECT * FROM permissions WHERE userid = '${request.get('editor')}';`)).rows;
    let perms = rows[0].perms.split(',');
    perms.splice(rows[0].perms.indexOf(request.params.channel), 1);
    await client.query(`UPDATE permissions SET perms = '${perms.join(',')}' WHERE userid = '${request.get('editor')}';`);
    client.release();

    response.sendStatus(200);
  } catch (err) {
    console.log(err);
    response.sendStatus(500);
  }
});


// States.
let states = [];


// Modules.
app.get('/modules/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel]) {
      response.sendStatus(404);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    let page = fs.readFileSync('./html/modules.html').toString('utf-8');
    page = page.replace(/#Placeholder#/g, userIds[request.params.channel.toLowerCase()].user_id);
    page = page.replace('let tabsEnabled = {};', `let tabsEnabled = {
      'Warzone Stats / Matches': ${userIds[request.params.channel.toLowerCase()].matches},
      'Revolver Roulette': ${userIds[request.params.channel.toLowerCase()].revolverroulette},
      'Coinflip': ${userIds[request.params.channel.toLowerCase()].coinflip},
      'Rock Paper Scissors': ${userIds[request.params.channel.toLowerCase()].rps},
      'Big Vanish': ${userIds[request.params.channel.toLowerCase()].bigvanish},
      'Custom Tourney': ${userIds[request.params.channel.toLowerCase()].customs},
      'Two vs Two': ${userIds[request.params.channel.toLowerCase()]["two_v_two"]},
      'Duels': ${userIds[request.params.channel.toLowerCase()].duel}
    };`);
    page = page.replace(/#Acti#/g, userIds[request.params.channel.toLowerCase()] && userIds[request.params.channel.toLowerCase()].acti_id?userIds[request.params.channel.toLowerCase()].acti_id:''); 
    page = page.replace(/#pref_name#/g, userIds[request.params.channel.toLowerCase()].pref_name || '');

    response.send(page);
  } catch (err) {
    console.log(err);
    response.sendStatus(500);
  }
});


// Enable/disable modules.
app.get('/modules/:channel/:module', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel] || !userIds[request.params.channel].twitch) {
      response.sendStatus(405);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.status(401);
        response.redirect('/');
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    if (request.params.module === 'two_v_two' && tvtInt[request.params.channel]) {
      clearInterval(tvtInt[request.params.channel]);
      delete tvtInt[request.params.channel];
    }

    let str = '';
    if (request.params.module === 'matches' && (userIds[request.params.channel].acti_id === '' || userIds[request.params.channel].acti_id !== decodeURIComponent(request.get('Acti') || ''))) {
      if (profanity.isProfane(request.get('Acti') || '')) throw new Error('No profanity allowed.');
      str += `, acti_id = '${decodeURIComponent(request.get('Acti') || '')}'`;
      userIds[request.params.channel].acti_id = decodeURIComponent(request.get('Acti') || '');
      if (userIds[request.params.channel].acti_id === '') {
        userIds[request.params.channel].uno_id = '';
        str += `, uno_id = ''`;
      }
    }

    // @ts-ignore
    if (request.params.module === 'matches' && !userIds[request.params.channel].matches && (userIds[request.params.channel].acti_id !== decodeURIComponent(request.get('Acti')) || userIds[request.params.channel].uno_id === '')) {
      let data = await last20(request.get('Acti'), 'uno');
      str += `, uno_id = '${data.matches[0].player.uno}'`;
    }

    userIds[request.params.channel][request.params.module] = !userIds[request.params.channel][request.params.module];
    client = await pool.connect();
    await client.query(`UPDATE allusers SET ${request.params.module} = ${userIds[request.params.channel][request.params.module]}${str} WHERE user_id = '${request.params.channel}';`);
    client.release();

    response.sendStatus(200);
  } catch (err) {
    console.log(err);
    response.sendStatus(err.toString().includes('not allowed')?401:err.toString().includes('Not found')?404:500);
  }
});


// Set new preferred name.
app.get('/newname/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel]) {
      response.sendStatus(404);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    if (profanity.isProfane(request.get('pref_name') || '')) throw new Error('No profanity allowed.');
    userIds[request.params.channel].pref_name = request.get('pref_name');

    client = await pool.connect();
    await client.query(`UPDATE allusers SET pref_name = '${request.get('pref_name')}' WHERE user_id = '${request.params.channel}';`);
    client.release();

    response.sendStatus(200);
  } catch (err) {
    console.log(err);
    response.sendStatus(500);
  }
});


// Manage editors.
app.get('/editors/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel]) {
      response.status(404);
      response.redirect('/');
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.status(401);
        response.redirect('/');
        return;
      }
    } else {
      response.status(401);
      response.redirect('/');
      return;
    }

    
  } catch (err) {
    console.log(err);
    response.sendStatus(500);
  }
});


// Redirect.
app.get('/redirect', (request, response) => {
  response.send(fs.readFileSync("./html/redirect.html").toString("utf-8"));
});


// Log in to Twitch.
app.get('/login', async (request, response) => {
  let cookies = request.cookies;
  if (!cookies["auth"]) {
    let state;
    do {
      state = makeid(20);
    } while (states.includes(state));
    states[state] = '#login#';
    let page = fs.readFileSync('./html/verify.html').toString('utf-8');
    // @ts-ignore
    page = page.replace('${process.env.CLIENT_ID}', process.env.CLIENT_ID);
    page = page.replace('${state}', state);
    response.send(page);
    setTimeout(function() {
      if (states.indexOf(state) > -1) delete states[state];
    }, 30000);
  } else {
    let client = await pool.connect();
    await client.query(`UPDATE permissions SET bearer = '' WHERE bearer = '${cookies["auth"]}';`);
    client.release();
    response.clearCookie('auth', {
      'domain': '.zhekbot.com',
      secure: true,
      httpOnly: true
    });
    response.redirect('/');
  }
});


// Verify state.
app.get('/verify', (request, response) => {
  try {
    if (request.get("state") === "access_denied") {
      console.log("Access denied in login.");
      response.send("Access was denied.");
      return;
    }
    
    if (Object.keys(states).includes(request.get("state") || '')) {
      got('https://id.twitch.tv/oauth2/token', {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: `client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&grant_type=client_credentials`
      }).then(resp => {
        got('https://api.twitch.tv/helix/users?', {
          method: "GET",
          headers: {
            'Authorization': `Bearer ${request.get("access_token")}`,
            'Client-Id': process.env.CLIENT_ID
          }
        }).then(async res => {
          let details = JSON.parse(res.body).data;
          let client = await pool.connect();
          let rows = (await client.query(`SELECT * FROM permissions WHERE userid = '${details[0]["display_name"].toLowerCase()}';`)).rows;
          // @ts-ignore
          if (rows.length && (rows[0].perms.split(',').includes(states[request.get("state")]) || details[0]["display_name"].toLowerCase() === states[request.get("state")] || states[request.get("state")] === "#login#")) {
            await client.query(`UPDATE permissions SET bearer = '${JSON.parse(resp.body)["access_token"]}' WHERE userid = '${details[0]["display_name"].toLowerCase()}';`);
            response.cookie("auth", JSON.parse(resp.body)["access_token"], { maxAge: 1000*JSON.parse(resp.body).expires_in, secure: true, httpOnly: true, domain: `.zhekbot.com` });
            response.send("Success.");
          } else {
            // @ts-ignore
            if (details[0]["display_name"].toLowerCase() === states[request.get("state")] || states[request.get("state")] === '#login#') {
              await client.query(`INSERT INTO permissions(userid, bearer) VALUES ('${details[0]["display_name"].toLowerCase()}', '${JSON.parse(resp.body)["access_token"]}');`);
              response.cookie("auth", JSON.parse(resp.body)["access_token"], { maxAge: 1000*JSON.parse(resp.body).expires_in, secure: true, httpOnly: true, domain: `.zhekbot.com` });
              response.send("Success.");
            } else { 
              response.send("Login request failed."); 
              client.release();
              return;
            }
          }

          if (!userIds[details[0]["display_name"].toLowerCase()]) {
            userIds[details[0]["display_name"].toLowerCase()] = {
              "user_id": details[0]["display_name"].toLowerCase(),
              "uno_id": '',
              "platform": "uno",
              "customs": false,
              "matches": false,
              "revolverroulette": false,
              "coinflip": false,
              "rps": false,
              "bigvanish": false,
              "acti_id": '',
              "subs": false,
              "two_v_two": false,
              "twitch": false,
              "duel": false,
              "pref_name": details[0]["display_name"]
            };
            await client.query(`INSERT INTO allusers(user_id, pref_name) VALUES ('${details[0]["display_name"].toLowerCase()}', '${details[0]["display_name"]}');`);
          }

          client.release();
        }).catch(err => {
          console.log(err);
          response.send(err);
        });
      }).catch(err => {
        console.log(err);
        response.send(err);
      });
    } else {
      console.log("Invalid state.");
      response.send("The request has expired, please try again.");
    }
  } catch (err) {
    console.log(err);
    response.send(err);
  }
});


// Random string.
function makeid(length) {
  var result = '';
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  var charactersLength = characters.length;
  for ( var i = 0; i < length; i++ ) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
}


// 2v2
app.get('/twovtwo/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel]) {
      response.status(404);
      response.send(fs.readFileSync('./html/not_found.html'));
      return;
    }
    
    let cookies = request.cookies;
    if (cookies["auth"]) {
      let client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.status(401);
        response.redirect('/');
        return;
      }
    } else {
      response.status(401);
      response.redirect('/');
      return;
    }

    let page = fs.readFileSync('./html/two_v_two.html').toString('utf-8');
    page = page.replace(/#Placeholder#/g, userIds[request.params.channel.toLowerCase()]["pref_name"]);
    page = page.replace(/#channel#/g, userIds[request.params.channel].user_id);
    response.send(page);
  } catch (err) {
    console.log(err);
    response.send(err.message);
  }
});


// Get 2v2 scores.
app.get ('/twovtwoscores/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel] || !userIds[request.params.channel].twitch) {
      response.sendStatus(405);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.status(401);
        response.redirect('/');
        return;
      }
    } else {
      response.status(401);
      response.redirect('/');
      return;
    }

    client = await pool.connect();
    let res = await client.query(`SELECT * FROM twovtwo WHERE userid = '${request.params.channel}';`);
    if (!res.rows.length) {
      res.rows = [{ 
        hkills: 0,
        tkills: 0,
        o1kills: 0,
        o2kills: 0,
        tname: '',
        o1name: '',
        o2name: '',
        mapreset: 0
      }];
      await client.query(`INSERT INTO twovtwo(userid, hkills, tkills, o1kills, o2kills, tname, o1name, o2name, mapreset) VALUES ('${request.params.channel}', 0, 0, 0, 0, '', '', '', 0);`);
    }
    client.release();

    response.send(`${res.rows[0].hkills} ${res.rows[0].tkills} ${res.rows[0].o1kills} ${res.rows[0].o2kills} ${res.rows[0].tname} ${res.rows[0].o1name} ${res.rows[0].o2name} ${userIds[res.rows[0].userid] && userIds[res.rows[0].userid]["two_v_two"]} ${userIds[res.rows[0].tname] && userIds[res.rows[0].tname]["two_v_two"]} ${userIds[res.rows[0].o1name] && userIds[res.rows[0].o1name]["two_v_two"]} ${userIds[res.rows[0].o2name] && userIds[res.rows[0].o2name]["two_v_two"]} ${tvtInt[request.params.channel]?true:false} ${res.rows[0].mapreset}`);
  } catch (err) {
    console.log(`Error getting 2v2 scores: ${err}`);
    response.send(err.message);
  }
});


// Post
app.get('/post/:channel/:hKills/:tKills/:o1Kills/:o2Kills', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel] || !userIds[request.params.channel].twitch) {
      response.sendStatus(405);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    client = await pool.connect();
    await client.query(`UPDATE twovtwo SET hkills = ${request.params.hKills}, tkills = ${request.params.tKills}, o1kills = ${request.params.o1Kills}, o2kills = ${request.params.o2Kills}, tname = '${request.get('tname')}', o1name = '${request.get('o1name')}', o2name = '${request.get('o2name')}', mapreset = ${request.get('mapreset') || 0} WHERE userid = '${request.params.channel}';`);
    if (userIds[request.get('tname')] && userIds[request.get('tname')]["two_v_two"]) {
      await client.query(`UPDATE twovtwo SET hkills = ${request.params.tKills}, tkills = ${request.params.hKills}, o1kills = ${request.params.o1Kills}, o2kills = ${request.params.o2Kills}, mapreset = ${request.get('mapreset') || 0} WHERE userid = '${request.get('tname')}';`)
    }
    if (userIds[request.get('o1name')] && userIds[request.get('o1name')]["two_v_two"]) {
      await client.query(`UPDATE twovtwo SET hkills = ${request.params.o1Kills}, tkills = ${request.params.o2Kills}, o1kills = ${request.params.hKills}, o2kills = ${request.params.tKills}, mapreset = ${-1*parseInt(request.get('mapreset') || '0')} WHERE userid = '${request.get('o1name')}';`)
    }
    if (userIds[request.get('o2name')] && userIds[request.get('o2name')]["two_v_two"]) {
      await client.query(`UPDATE twovtwo SET hkills = ${request.params.o2Kills}, tkills = ${request.params.o1Kills}, o1kills = ${request.params.hKills}, o2kills = ${request.params.tKills}, mapreset = ${-1*parseInt(request.get('mapreset') || '0')} WHERE userid = '${request.get('o2name')}';`)
    }
    client.release();

    response.sendStatus(tvtInt[request.params.channel.toLowerCase()]?200:201);
  } catch (err) {
    console.log(`Error during 2v2 update: ${err}`);
    response.sendStatus(500);
  }
});


// Reset
app.get('/post/:channel/reset', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel] || !userIds[request.params.channel].twitch) {
      response.sendStatus(405);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    client = await pool.connect();
    await client.query(`UPDATE twovtwo SET hKills = 0, tKills = 0, o1Kills = 0, o2Kills = 0 WHERE userid = '${request.params.channel}';`);
    if (userIds[request.get('tname')] && userIds[request.get('tname')]["two_v_two"]) {
      await client.query(`UPDATE twovtwo SET hKills = 0, tKills = 0, o1Kills = 0, o2Kills = 0 WHERE userid = '${request.get('tname')}';`)
    }
    if (userIds[request.get('o1name')] && userIds[request.get('o1name')]["two_v_two"]) {
      await client.query(`UPDATE twovtwo SET hKills = 0, tKills = 0, o1Kills = 0, o2Kills = 0 WHERE userid = '${request.get('tname')}';`)
    }
    if (userIds[request.get('o2name')] && userIds[request.get('o2name')]["two_v_two"]) {
      await client.query(`UPDATE twovtwo SET hKills = 0, tKills = 0, o1Kills = 0, o2Kills = 0 WHERE userid = '${request.get('tname')}';`)
    }
    client.release();

    response.sendStatus(200);
  } catch (err) {
    console.log(`Error during 2v2 reset: ${err}`);
    response.sendStatus(500);
  }
});


// Enable
app.post('/post/:channel/enable', jsonParser, async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel] || !userIds[request.params.channel].twitch) {
      response.sendStatus(405);
      return;
    }
    
    let cookies = request.cookies;
    let client, rows;
    if (cookies["auth"]) {
      client = await pool.connect();
      rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel && !rows[0].perms.split(',').includes(request.params.channel))) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    let status = request.body;
    let updates = [];

    status['hStatus'] = userIds[request.get('hname')] && status['hStatus'];
    status['tStatus'] = userIds[request.get('tname')] && status['tStatus'] && rows[0].perms && rows[0].perms.split(',').includes(request.get('tname'));
    status['o1Status'] = userIds[request.get('o1name')] && status['o1Status'] && rows[0].perms && rows[0].perms.split(',').includes(request.get('o1name'));
    status['o2Status'] = userIds[request.get('o2name')] && status['o2Status'] && rows[0].perms && rows[0].perms.split(',').includes(request.get('o2name'));

    if (userIds[request.get('hname')] && userIds[request.get('hname')]["two_v_two"] !== status["hStatus"]) {
      userIds[request.get('hname')]["two_v_two"] = status["hStatus"];
      // @ts-ignore
      updates[request.get('hname')] = status["hStatus"];
      if (!status["hStatus"]) {
        clearInterval(tvtInt[request.get('hname')]);
        delete tvtInt[request.get('hname')];
        delete tvtUpdate[request.get('hname')];
      }
    }

    if (userIds[request.get('tname')] && userIds[request.get('tname')]["two_v_two"] !== status["tStatus"]) {
      userIds[request.get('tname')]["two_v_two"] = status["tStatus"];
      // @ts-ignore
      updates[request.get('tname')] = status["tStatus"];
      if (!status["tStatus"]) {
        clearInterval(tvtInt[request.get('tname')]);
        delete tvtInt[request.get('tname')];
        delete tvtUpdate[request.get('tname')];
      }
    }  

    if (userIds[request.get('o1name')] && userIds[request.get('o1name')]["two_v_two"] !== status["o1Status"]) {
      userIds[request.get('o1name')]["two_v_two"] = status["o1Status"];
      // @ts-ignore
      updates[request.get('o1name')] = status["o1Status"];
      if (!status["o1Status"]) {
        clearInterval(tvtInt[request.get('o1name')]);
        delete tvtInt[request.get('o1name')];
        delete tvtUpdate[request.get('o1name')];
      }
    }  
    
    if (userIds[request.get('o2name')] && userIds[request.get('o2name')]["two_v_two"] !== status["o2Status"]) {
      userIds[request.get('o2name')]["two_v_two"] = status["o2Status"];
      // @ts-ignore
      updates[request.get('o2name')] = status["o2Status"];
      if (!status["o2Status"]) {
        clearInterval(tvtInt[request.get('o2name')]);
        delete tvtInt[request.get('o2name')];
        delete tvtUpdate[request.get('o2name')];
      }
    }

    status["needsUpdate"] = false;

    response.status(200);

    if (!updates) {
      response.send(status);
      return;
    }

    let str = '';
    let keys = Object.keys(updates);
    
    client = await pool.connect();

    for (let i = 0; i < keys.length; i++) {
      str += `('${keys[i]}'::text, ${updates[keys[i]]}::bool)${i + 1 === keys.length?'':', '}`;

      if (keys[i] === 'huskerrs') { bot.say('huskerrs', `!enable !score ${!updates['huskerrs']}`)};
      bot.say(keys[i], `Score reporting ${updates[keys[i]]?'enabled':'disabled'}`);

      let rows = await client.query(`SELECT * FROM twovtwo WHERE userid = '${keys[i]}';`);
      if (rows.rows.length) {
        await client.query(`UPDATE twovtwo SET hkills = 0, tkills = 0, o1kills = 0, o2kills = 0 WHERE userid = '${keys[i]}';`);
      } else {
        await client.query(`INSERT INTO twovtwo(hkills, tkills, o1kills, o2kills, userid) VALUES (0, 0, 0, 0, '${keys[i]}');`)
      }

      await client.query(`UPDATE allusers SET two_v_two = ${updates[keys[i]]}::bool WHERE user_id = '${keys[i]}'::text;`)
    }
    client.release();

    response.send(status);
  } catch (err) {
    console.log('Enable function: ' + err);
    response.sendStatus(500);
  }
});


// Pause scores
app.get('/tvtpause/:channel', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel] || !userIds[request.params.channel].twitch) {
      response.sendStatus(405);
      return;
    }

    if (!userIds[request.params.channel].two_v_two) {
      response.sendStatus(406);
      return;
    }
    
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    if (userIds[request.params.channel] && userIds[request.params.channel]["two_v_two"]) {
      if (tvtInt[request.params.channel]) {
        clearInterval(tvtInt[request.params.channel]);
        delete tvtInt[request.params.channel];
      } else {
        tvtInt[request.params.channel] = setInterval(function(){tvtscores(request.params.channel)}, 30000);
      }
    }

    if (userIds[request.get('tname')] && userIds[request.get('tname')]["two_v_two"]) {
      if (tvtInt[request.get('tname')]) {
        clearInterval(tvtInt[request.get('tname')]);
        delete tvtInt[request.get('tname')];
      } else {
        tvtInt[request.get('tname')] = setInterval(function(){tvtscores(request.get('tname'))}, 30000);
      }
    }

    if (userIds[request.get('o1name')] && userIds[request.get('o1name')]["two_v_two"]) {
      if (tvtInt[request.get('o1name')]) {
        clearInterval(tvtInt[request.get('o1name')]);
        delete tvtInt[request.get('o1name')];
      } else {
        tvtInt[request.get('o1name')] = setInterval(function(){tvtscores(request.get('o1name'))}, 30000);
      }
    }

    if (userIds[request.get('o2name')] && userIds[request.get('o2name')]["two_v_two"]) {
      if (tvtInt[request.get('o2name')]) {
        clearInterval(tvtInt[request.get('o2name')]);
        delete tvtInt[request.get('o2name')];
      } else {
        tvtInt[request.get('o2name')] = setInterval(function(){tvtscores(request.get('o2name'))}, 30000);
      }
    }

    response.sendStatus(tvtInt[request.get('hname')]?201:200);
  } catch (err) {
    console.log(`Error during 2v2 pause: ${err}`);
    response.sendStatus(500);
  }
});


// Receive scores
app.get('/send/:channel/:hKills/:tKills/:o1Kills/:o2Kills', async (request, response) => {
  try {
    request.params.channel = request.params.channel.toLowerCase();
    if (!userIds[request.params.channel] || !userIds[request.params.channel].twitch) {
      response.sendStatus(405);
      return;
    }
    let cookies = request.cookies;
    let client;
    if (cookies["auth"]) {
      client = await pool.connect();
      let rows = (await client.query(`SELECT * FROM permissions WHERE bearer = '${cookies["auth"]}';`)).rows;
      client.release();
      if (!rows.length || (rows[0].userid !== request.params.channel.toLowerCase() && !rows[0].perms.split(',').includes(request.params.channel.toLowerCase()))) {
        response.sendStatus(401);
        return;
      }
    } else {
      response.sendStatus(401);
      return;
    }

    client = await pool.connect();
    await client.query(`UPDATE twovtwo SET hkills = ${request.params.hKills}, tkills = ${request.params.tKills}, o1kills = ${request.params.o1Kills}, o2kills = ${request.params.o2Kills}, tname = '${request.get('tname')}', o1name = '${request.get('o1name')}', o2name = '${request.get('o2name')}', mapreset = ${parseInt(request.get('mapreset') || '0')} WHERE userid = '${request.params.channel}';`);
    if (userIds[request.get('tname')] && userIds[request.get('tname')]["two_v_two"]) {
      await client.query(`UPDATE twovtwo SET hkills = ${request.params.tKills}, tkills = ${request.params.hKills}, o1kills = ${request.params.o1Kills}, o2kills = ${request.params.o2Kills}, mapreset = ${parseInt(request.get('mapreset') || '0')} WHERE userid = '${request.get('tname')}';`)
      await tvtscores(request.get('tname'), true);
    }
    if (userIds[request.get('o1name')] && userIds[request.get('o1name')]["two_v_two"]) {
      await client.query(`UPDATE twovtwo SET hkills = ${request.params.o1Kills}, tkills = ${request.params.o2Kills}, o1kills = ${request.params.hKills}, o2kills = ${request.params.tKills}, mapreset = ${-1*parseInt(request.get('mapreset') || '0')} WHERE userid = '${request.get('o1name')}';`)
      await tvtscores(request.get('o1name'), true);
    }
    if (userIds[request.get('o2name')] && userIds[request.get('o2name')]["two_v_two"]) {
      await client.query(`UPDATE twovtwo SET hkills = ${request.params.o2Kills}, tkills = ${request.params.o1Kills}, o1kills = ${request.params.hKills}, o2kills = ${request.params.tKills}, mapreset = ${-1*parseInt(request.get('mapreset') || '0')} WHERE userid = '${request.get('o2name')}';`)
      await tvtscores(request.get('o2name'), true);
    }
    client.release();

    await tvtscores(request.params.channel.toLowerCase(), true);

    response.sendStatus(200);
  } catch (err) {
    console.log(`Error during send: ${err}`);
    response.sendStatus(500);
  }
});


// Wins for c_o_l_e
app.get('/wins/:user', async (request, response) => {
  try {
    let data = await lifetime(encodeURIComponent(request.params.user), 'uno');
    response.send(`I got ${data.lifetime.mode.br.properties.wins} dubskies!`);
  } catch (err) {
    console.log(err);
  }
});


// API endpoint to format ban statements for accounts in BrookeAB's chat which were created and followed within 6 hours.
// @ts-ignore
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
    response.send(`/w zHekLeR Error during brookescribers @ ${Date.now()}`);
  }
});


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

    let uriUser = encodeURIComponent(username);
    console.log(uriUser);

    // Get stats.
    let data = await lifetime(uriUser, platform);

    if (data === 'Not permitted: not allowed') {
      return 'Account is private.';
    } 

    // Format stats.
    let time = `${(data.lifetime.mode.br.properties.timePlayed/3600).toFixed(2)} Hours`;
    let lk = data.lifetime.mode.br.properties.kdRatio.toFixed(2);
    let wk = data.weekly.mode.br_all?data.weekly.mode.br_all.properties.kdRatio.toFixed(2):'-';
    let wins = data.lifetime.mode.br.properties.wins;
    let kills = data.lifetime.mode.br.properties.kills;

    // Return response.
    return `${data.username} | Time Played: ${time} | Lifetime KD: ${lk} | Weekly KD: ${wk} | Total Wins: ${wins} | Total Kills: ${kills}`;

  } catch (err) {
    console.log(err);
    return err.toString().includes('not allowed')?'Account is private.':'Error getting stats.';
  }
};


// Get user's last match info.
async function lastGame(username) { 
  try {
    let client = await pool.connect();
    let rows = (await client.query(`SELECT * FROM matches WHERE user_id = '${userIds[username].acti_id}' ORDER BY timestamp DESC LIMIT 1;`)).rows;
    client.release();
    
    // If cache is still empty, return.
    if (!rows.length) {
      console.log('No matches found.')
      return 'No matches found.';
    }

    // Get match object.
    let match = rows[0];

    // Format teammates, if any.
    let teammates = ' | Teammates: ';
    if (!match.teammates.length) teammates += '-';
    for (let i = 0; i < match.teammates.length; i++) { teammates += (!i?'':' | ') + `${match.teammates[i].name} (${match.teammates[i].kills}K, ${match.teammates[i].deaths}D)`; }
    
    // Return response.
    return `${match.game_mode} | ${match.placement} place | ${userIds[username].pref_name} (${match.kills}K, ${match.deaths}D) | Gulag: ${match.gulag_kills?'Won':match.gulag_deaths?'Lost':'-'} ${teammates}`;

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
    let midnight = (DateTime.now().setZone('America/Los_Angeles').startOf('day')/1000) - userIds[username].time_offset;

    let client = await pool.connect();
    let rows = (await client.query(`SELECT * FROM matches WHERE user_id = '${userIds[username].acti_id}' AND timestamp > ${midnight};`)).rows;
    client.release();

    // Base values.
    let dailyGames = 0;
    let kGame = 0;
    let dGame = 0;
    let wins = 0;
    let streak = 0;
    let gulag_kills = 0;
    let gulag_deaths = 0;

    // Increment stats.
    for (let i = 0; i < rows.length; i++) {
      dailyGames++;
      kGame += rows[i].kills;
      dGame += rows[i].deaths;
      wins += rows[i].placement === "1st"?1:0;
      streak = rows[i].streak > streak?rows[i].streak:streak;
      gulag_kills += rows[i].gulag_kills;
      gulag_deaths += rows[i].gulag_deaths;
    }

    // Return response.
    return `Daily Stats | Games: ${dailyGames} | Kills/Game: ${dailyGames?(kGame/dailyGames).toFixed(2):'-'} | Deaths/Game: ${dailyGames?(dGame/dailyGames).toFixed(2):'-'} | K/D: ${dGame?(kGame/dGame).toFixed(2):kGame?kGame:'-'} | Wins: ${wins} | Longest Kill Streak: ${streak} | Gulag: ${rows.length?String(gulag_kills) + ' / ' + String(gulag_deaths):'-'}`;

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
    let midnight = (DateTime.now().setZone('America/Los_Angeles').startOf('day')/1000) - userIds[username].time_offset;

    let client = await pool.connect();
    let rows = (await client.query(`SELECT * FROM matches WHERE user_id = '${userIds[username].acti_id}' AND timestamp > ${midnight};`)).rows;
    client.release();

    // Base object.
    let bombs = [];

    // Increment stats.
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].kills >= 30) bombs.push(rows[i].kills);
    }

    // Return response.
    return `${userIds[username].pref_name} has dropped ${bombs.length} bomb${bombs.length==1?'':'s'} (30+ kill games) today ${bombs.length?'('+bombs.join('K, ')+'K)':''}`;

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
    let midnight = (DateTime.now().setZone('America/Los_Angeles').startOf('day')/1000) - userIds[username].time_offset;

    let client = await pool.connect();
    let rows = (await client.query(`SELECT * FROM matches WHERE user_id = '${userIds[username].acti_id}' AND timestamp > ${midnight};`)).rows;
    client.release();

    // Base object.
    let wins = [];

    // Increment stats.
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].placement === '1st') wins.push(rows[i].kills);
    }

    // Return response.
    return `${userIds[username].pref_name} has won ${wins.length} game${wins.length==1?'':'s'} today ${wins.length?'(' + wins.join('K, ') + 'K)':''}`;

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
    let midnight = (DateTime.now().setZone('America/Los_Angeles').startOf('day')/1000) - userIds[username].time_offset;

    let client = await pool.connect();
    let rows = (await client.query(`SELECT * FROM matches WHERE user_id = '${userIds[username].acti_id}' AND timestamp > ${midnight};`)).rows;
    client.release();

    // Base values.
    let gulag_kills = 0;
    let gulag_deaths = 0;

    // Increment stats.
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].gulag_kills) { 
        gulag_kills++;
      } else if (rows[i].gulag_deaths) {
        gulag_deaths++;
      } 
    }

    // Return response.
    return `${userIds[username].pref_name} has ${gulag_kills} win${gulag_kills==1?'':'s'} and ${gulag_deaths} loss${gulag_deaths==1?'':'es'} in the gulag today.`;

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
    let data = await lifetime('HusKerrs', 'uno');
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
// @ts-ignore
app.get('/wordlelb', async (req, response) => {
  try {
    response.send(await wordle.wordleLb());
  } catch (err) {
    console.log(`Error getting Wordle leaderboard: ${err}`);
    response.send(`Error getting Wordle leaderboard.`);
  }
});


// Default not found page.
// @ts-ignore
app.get("*", (req, response) => {
  response.status(404);
  let page = fs.readFileSync("./html/not_found.html").toString('utf-8');
  if (req.cookies["auth"]) {
    page = page.replace('Login to Twitch', 'Logout of Twitch');
  }
  response.send(page);
});


// Pull matches from codtracker between every 5 and store in database.
async function updateMatches() {
  try {
    Object.keys(userIds).forEach((key, i) => {
      if (userIds[key].matches && userIds[key].twitch && key !== 'zhekler') {
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
            let res = await client.query(`SELECT * FROM matches WHERE user_id = '${userIds[key].acti_id}' ORDER BY timestamp DESC;`);
            mCache[userIds[key].acti_id] = res.rows;
            client.release();
            
            // Update timestamp of last match.
            lastTimestamp = res.rows.length?res.rows[0].timestamp:lastTimestamp;
            
            // Fetch last 20 matches for user from COD API.
            let data;
            try { 
              data = await last20(encodeURIComponent(userIds[key].acti_id), userIds[key].platform); 
              if (!data) throw new Error('Matches undefined.');
              await update(data.matches, userIds[key], lastTimestamp);
              
              // Get stats for each match and push to database.
              console.log(`Updated matches for ${userIds[key].acti_id}.`);
            }
            catch (err) { setTimeout(async () => { 
              try { 
                console.log(`Error: ${userIds[key].acti_id}, retrying: ${err}`); 
                data = await last20(encodeURIComponent(userIds[key].acti_id), userIds[key].platform); 
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
      }
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
        if (placement.length >= 2 && placement.charAt(placement.length - 2) === '1') {
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
      game_mode = Object.keys(game_modes).includes(matches[i].mode)?game_modes[matches[i].mode]:matches[i].mode;

      // Set gulag stats.
      gulag_kills = 0;
      gulag_deaths = 0;
      if (!game_mode.includes('Resurgence') && !game_mode.includes('Rebirth') && !game_mode.includes('respect') && !game_mode.includes('Champion')) {
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
    // @ts-ignore
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
                if (res2.data.data[0]) {
                let created = (new Date(res2.data.data[0].created_at)).getTime()/1000;
                if (created > sixAgo && !fLast.includes(res2.data.data[0].login)) them.push(`('${res2.data.data[0].login}', ${followed}, ${created})`);
                } else {
                  console.log(`${temp[i].from_id}: ${res2.data}`);
                }
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

      if (temp[i].twitch) {
        // @ts-ignore
        bot.channels.push(temp[i].user_id);
        gcd[temp[i].user_id] = { };
      }
    };

    // Set the 5 minute interval for each player being tracked and get their active elements.
    intervals["matches"] = setInterval(async() => { 
      try { 
        await updateMatches();
      } catch (err) {
        console.log(`Match intervals: ${err}`);
      }
    }, 300000);

    setInterval(function() { duelExpiration(); }, 5000);

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