// Import Pool for accessing the database.
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
});


// Constants.
const choices = { "h": 1, "heads": 1, "t": 0, "tails": 0 };


// Function to flip a coin. If the user guesses the result incorrectly, they get timed out for 1 minute.
async function coinflip(id, input, channel) {
  try {

    // Declare variable..
    let choice;

    // Determine if input is valid.
    if (Object.keys(choices).includes(input.toLowerCase())) {
      choice = choices[input.toLowerCase()];
    } else {
      return `@${id}: ${input} is not a correct input.`;
    }

    // Determine outcome.
    let rand = Math.floor(Math.random()*2);
    let shoot = `${rand==choice?'/me '+id+' has guessed correctly!':'/timeout '+id+' 60 You did NOT guess correctly!'}`;

    // Pull user from the database.
    let client = await pool.connect();
    let res = await client.query(`SELECT * FROM coinflip WHERE user_id = '${id}' AND stream = '${channel.substring(1)}';`);
    let person = res.rows[0];

    if (!person) {

      // User has not played before. Add stats to database.
      person = { user_id: id, correct: rand==choice?1:0, wrong: rand==choice?0:1 };
      await client.query(`INSERT INTO coinflip(user_id, correct, wrong, stream)VALUES('${person.user_id}', ${person.correct}, ${person.wrong}, '${channel.substring(1)}');`);

    } else {

      // Update user's stats in database.
      person.correct += rand==choice?1:0;
      person.wrong += rand==choice?0:1;
      await client.query(`UPDATE coinflip SET ${rand==choice?'correct':'wrong'} = ${rand==choice?person.correct:person.wrong} WHERE user_id = '${id}' AND stream = '${channel.substring(1)}';`);

    }

    // Release client.
    client.release();

    // Return response.
    return shoot + ` ${id} has guessed correctly ${person.correct} time${person.correct==1?'':'s'} and wrong ${person.wrong} time${person.wrong==1?'':'s'}!`;

  } catch (err) {
    console.log(err);
    return;
  }
}


// Function to get user's stats.
async function coinflipScore(id, channel) {
  try {

    // Pull user from the database.
    let client = await pool.connect();
    let res = await client.query(`SELECT * FROM coinflip WHERE user_id = '${id}' AND stream = '${channel.substring(1)}';`);
    let person = res.rows[0];
    client.release();

    // Declare response string.
    let str;
    if (person) {

      // Format user's stats.
      str = `${person.user_id} has guessed Coinflip correctly ${person.correct} time${person.correct==1?'':'s'} and wrong ${person.wrong} time${person.wrong==1?'':'s'}!`

    } else {

      // User has not played.
      str = `${id} has not played Coinflip!`;

    }

    // Return response.
    return str;

  } catch (err) {
    console.log(err);
    return;
  }
};


// Function to get the leaderboard.
async function coinflipLb(channel) {
  try {
    
    // Pull top users from the database.
    let client = await pool.connect();
    let res = await client.query(`(SELECT user_id, correct, wrong FROM coinflip WHERE correct = (SELECT MAX (correct) FROM coinflip WHERE stream = '${channel.substring(1)}') LIMIT 1) UNION ALL (SELECT user_id, correct, wrong FROM coinflip WHERE wrong = (SELECT MAX (wrong) FROM coinflip WHERE stream = '${channel.substring(1)}') LIMIT 1) ORDER BY correct DESC;`);
    let top = res.rows;
    client.release();

    // If there's just one user, they have both high scores.
    if (top.length < 2) {
      top.push(top[0]);
    }

    // Return response.
    return `Coinflip Leaderboard | Top Correct: ${top[0].user_id} (${top[0].correct}) | Top Wrong: ${top[1].user_id} (${top[1].wrong})`;

  } catch (err) {
    console.log(err);
    return;
  }
}


export { coinflip, coinflipScore, coinflipLb };