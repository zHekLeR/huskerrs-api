// Import Pool for accessing the database.
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
});


// Revolver Roulette! 1/3 chance to get timed out.
async function revolverroulette(id, channel) {
  try {

    // Get random number and determine whether the user won or lost.
    let rand = Math.floor(Math.random()*3);
    let shoot = `${rand?'/me '+id+' survived RR!':'/timeout '+id+' 300 BOOM you died!'}`;

    // Pull user from the Revolver Roulette database.
    let client = await pool.connect();
    let res = await client.query(`SELECT * FROM revolverroulette WHERE user_id = '${id}' AND stream = '${channel.substring(1)}';`);
    let person = res.rows[0];

    if (!person) {

      // User has not played before. Add them to the database.
      person = { user_id: id, survive: 0, die: 0 };
      await client.query(`INSERT INTO revolverroulette(user_id, survive, die, stream)VALUES('${person.user_id}', ${person.survive}, ${person.die}, '${channel.substring(1)}');`);
      shoot = `@${id}: Revolver Roulette is a game where you have 1/3 chance to be timed out for 5 min. You have been warned.`;

    } else {

      // Update players stats.
      person.survive += rand?1:0;
      person.die += rand?0:1;
      await client.query(`UPDATE revolverroulette SET ${rand?'survive':'die'} = ${rand?person.survive:person.die} WHERE user_id = '${id}' AND stream = '${channel.substring(1)}';`)
      shoot += ` ${id}'s record is ${person.survive} survival${person.survive == 1?'':'s'} and ${person.die} death${person.die == 1?'':'s'}!`;

    }

    // Release client.
    client.release();

    // Return response.
    return shoot;

  } catch (err) {
    console.log(err);
    return;
  }
};


// Function to get the user's Revolver Roulette stats.
async function revolverrouletteScore(id, channel) {
  try {

    // Pull user from the Revolver Roulette database.
    let client = await pool.connect();
    let res = await client.query(`SELECT * FROM revolverroulette WHERE user_id = '${id}' AND stream = '${channel.substring(1)}';`);
    let person = res.rows[0];
    client.release();

    // Declare base response string.
    let str;
    if (person) {

      // Format user stats.
      str = `${person.user_id} has survived Revolver Roulette ${person.survive} time${person.survive==1?'':'s'} and died ${person.die} time${person.die==1?'':'s'}! That's a ${person.die?(100*(person.survive/(person.survive+person.die))).toFixed(2)+'%':'perfect'} win rate!`

    } else {

      // User has not played.
      str = `${id} has not played Revolver Roulette!`;

    }

    // Return response.
    return str;

  } catch (err) {
    console.log(err);
    return;
  }
};


// Function to retrieve the leaderboard for Revolver Roulette.
async function revolverrouletteLb(channel) {
  try {

    // Pull users from the database.
    let client = await pool.connect();
    let res = await client.query(`SELECT * FROM revolverroulette WHERE stream = '${channel.substring(1)}' ORDER BY survive DESC LIMIT 3;`);
    let top = res.rows;
    client.release();
    
    // Put em together.
    let str = [];
    for (let i = 0; i < top.length; i++) {
        str.push(`${top[i].user_id}: ${top[i].survive}`);
    }

    // Return response.
    return `Revolver Roulette Leaderboard: Survivals | ${str.join(' | ')}`;
  } catch (err) {
    console.log(err);
    return;
  }
};


// Function to retrieve the leaderboard for Revolver Roulette.
async function revolverrouletteLbDie(channel) {
  try {

    // Pull users from the database.
    let client = await pool.connect();
    let res = await client.query(`SELECT * FROM revolverroulette WHERE stream = '${channel.substring(1)}' ORDER BY die DESC LIMIT 3;`);
    let top = res.rows;
    client.release();
    
    // Put em together.
    let str = [];
    for (let i = 0; i < top.length; i++) {
        str.push(`${top[i].user_id}: ${top[i].die}`);
    }

    // Return response.
    return `Revolver Roulette Leaderboard: Deaths | ${str.join(' | ')}`;
  } catch (err) {
    console.log(err);
    return;
  }
};


// Function to retrieve the leaderboard for Revolver Roulette.
async function revolverrouletteLbRatio(channel) {
  try {

    // Pull users from the database.
    let client = await pool.connect();
    let res = await client.query(`SELECT user_id, survive, die, ROUND(survive * 100.0 / (survive + die), 2) AS percent FROM (SELECT * FROM revolverroulette WHERE survive + die >= 25 AND stream = '${channel.substring(1)}') AS rr ORDER BY percent DESC LIMIT 3;`);
    let top = res.rows;
    client.release();
    
    // Put em together.
    let str = [];
    for (let i = 0; i < top.length; i++) {
        str.push(`${top[i].user_id}: ${top[i].percent}% in ${top[i].survive + top[i].die} rounds`);
    }

    // Return response.
    return `Revolver Roulette Leaderboard: Survival Ratio | ${str.join(' | ')}`;
  } catch (err) {
    console.log(err);
    return;
  }
};


// Function to retrieve the leaderboard for Revolver Roulette.
async function revolverrouletteLbRatioLow(channel) {
  try {

    // Pull users from the database.
    let client = await pool.connect();
    let res = await client.query(`SELECT user_id, survive, die, ROUND(survive * 100.0 / (survive + die), 2) AS percent FROM (SELECT * FROM revolverroulette WHERE survive + die >= 25 AND stream = '${channel.substring(1)}') AS rr ORDER BY percent ASC LIMIT 3;`);
    let top = res.rows;
    client.release();
    
    // Put em together.
    let str = [];
    for (let i = 0; i < top.length; i++) {
        str.push(`${top[i].user_id}: ${top[i].percent}% in ${top[i].survive + top[i].die} rounds`);
    }

    // Return response.
    return `Revolver Roulette Leaderboard: Survival Ratio | ${str.join(' | ')}`;
  } catch (err) {
    console.log(err);
    return;
  }
};


// Function to get the total chat stats for Revolver Roulette.
async function revolverrouletteTotals(channel) {
  try {
    
    // Pull all users from the database.
    let client = await pool.connect();
    let res = await client.query(`SELECT SUM(survive) AS survives, SUM(die) AS deaths FROM revolverroulette WHERE stream = '${channel.substring(1)}';`);
    let top = res.rows;
    client.release();
    
    // Return response.
    return `Revolver Roulette Overall Stats | Survivals: ${top[0].survives} | Deaths: ${top[0].deaths}`;

  } catch (err) {
    console.log(err);
    return;
  }
};


export { revolverroulette, revolverrouletteScore, revolverrouletteLb, revolverrouletteLbDie, revolverrouletteLbRatio, revolverrouletteLbRatioLow, revolverrouletteTotals };