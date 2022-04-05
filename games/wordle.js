// Import Pool for accessing the database.
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE,
  ssl: {
    rejectUnauthorized: false
  }
});


// Define constants for response.
const lb = '┠';
const rb = '┨';
const y = '🟡';
const g = '🟢';
const r = '🔴';


// Define arrays of possible words and allowed words.
import fs from 'fs';
import { stringify } from 'querystring';
const possible = fs.readFileSync("./games/possible.txt").toString('utf-8').split("\n");
const allowed = fs.readFileSync("./games/allowed.txt").toString('utf-8').split("\n");


// Function to check accuracy of the guessed word.
function check(word, guess) {

    // Initialize result string and preset the boolean for the guess being the correct word.
    let result = lb;
    let correct = true;

    // Compare each character of the correct word and the guessed word.
    for (let i = 0; i < 5; i++) {

        if (word.charAt(i) === guess.charAt(i)) {
            
            // Character is in the correct place.
            result += g;

        } else if (word.includes(guess.charAt(i))) {
            
            // Check how many times this character appears in the correct word.
            let count = 0;
            for (let j = 0; j < 5; j++) {
                count += ((guess.charAt(i)===word.charAt(j)) && (word.charAt(j)===guess.charAt(j)))?1:0;
            }

            // If the character is in the word but in the wrong spot, add a yellow.
            // If the character is in the word but you already have it in the correct place, add a red.
            let split = word.split(guess.charAt(i)).join('');
            result += ((count >= (5 - split.length))?r:y);
            
            // Guessed word is not the correct word.
            correct = false;

        } else {

            // Character is not in the word.
            result += r;

            // Guessed word is not the correct word.
            correct = false;

        }
    }

    // Add the right bracket.
    result += rb;

    // Return a JSON value with the color-coded result of the guess and whether the guessed word is correct.
    return { "result": result, "correct": correct };

}


// Function to start the wordle for a user.
async function wordleStart(id) {
    try {

        // Pull this user from the Wordle database.
        let client = await pool.connect();
        let res = await client.query(`SELECT * FROM wordle WHERE user_id = '${id}';`);
        let user = res.rows[0];
    
        if (!user) {

            // User has not in the Wordle database. Select a new word for them and add data to the database.
            let wordle = possible[Math.floor(Math.random()*possible.length)];
            await client.query(`INSERT INTO wordle(user_id, word, remain, guess, best, wins, losses, streak, longest, checks)VALUES('${id}', '${wordle}', 6, ' ', 6, 0, 0, 0, 0, ' ');`);
            client.release();

            // Return confirmation to the user.
            return (`@${id}: You have 6 guesses starting now! Type !wordleguess [word] to guess!`);

        } else if (user.word.length < 5) {

            // User is in the Wordle database but does not currently have a word. Select a new word for them and update the database.
            let wordle = possible[Math.floor(Math.random()*possible.length)];
            await client.query(`UPDATE wordle SET word = '${wordle}', remain = 6, guess = ' ', checks = ' ' WHERE user_id = '${id}';`)
            client.release();

            // Return confirmation to the user.
            return `@${id}: You have 6 guesses starting now! Type !wordleguess [word] to guess!`;

        } else {

            // User is in the Wordle database and currently has a word. 
            let str = user.remain==6?`@${id}: You currently have a word and you haven't made any guesses. Type !wordleguess [word] to guess or !wordlesux to give up!`:
                `@${id}: Your last guess was ${user.guess.substring(user.guess.length-5)} (${user.checks}) and you have ${user.remain} guesses remaining. If you'd like to give up, type !wordlesux`;
            client.release();
            
            // Return response.
            return str;

        }
    } catch (err) {
    console.log(err);
    return;
  }
};


// Function to handle 
async function wordleGuess(id, guess) {
    try {

        // Check word length and whether it's in the list of allowed words.
        if (guess.length != 5 || !allowed.includes(guess.toLowercase())) {
            return `@${id}: Your guess must be a real 5-letter English word (no names/cities/proper nouns).`;
        }

        // Pull this user from the Wordle database.
        let client = await pool.connect();
        let res = await client.query(`SELECT * FROM wordle WHERE user_id = '${id}';`);
        let user = res.rows[0];

        // Declare response string.
        let resStr;
        
        // If the user is not in the Wordle or they don't have a word, return a message indicating such.
        if (!user || user.word.length != 5 || !possible.includes(user.word)) {
            resStr = `@${id}: You haven't started a Wordle yet. To start one, type !wordle`;
        } else {
        
            // Check the accuracy of the guessed word.
            let accuracy = check(user.word, guess);
            
            // Increment user stats for current round.
            user.remain--;
            user.guess += guess;

            // Determine response.
            if (accuracy.correct) {

                // User correctly guessed the word. Update stats.
                if ((6 - user.remain) < user.best) { user.best = 6 - user.remain; }
                user.streak++;
                if (user.streak > user.longest) { user.longest = user.streak; }

                // Update the Wordle database and set response string.
                await client.query(`UPDATE wordle SET word = ' ', remain = 6, guess = ' ', best = ${user.best}, wins = wins + 1, streak = ${user.streak}, longest = ${user.longest}, checks = ' ' WHERE user_id = '${id}';`);
                resStr = `@${id}: The word was ${user.word.toUpperCase()} and you got it in ${6 - user.remain} guess${user.remain==5?'':'es'}!`;

            } else {

                // Determine response based on number of remaining guesses.
                if (user.remain) {

                    // User has some guesses remaining. Update Wordle database and set response string.
                    await client.query(`UPDATE wordle SET remain = ${user.remain}, guess = '${user.guess}', checks = '${accuracy.result}' WHERE user_id = '${id}';`);
                    resStr = `@${id}: You guessed ${guess}. The result is ${accuracy.result}. You have ${user.remain} guesses remaining.`;

                } else {

                    // User ran out of guesses. Update Wordle database and set response string.
                    await client.query(`UPDATE wordle SET word = ' ', remain = 6, guess = ' ', losses = losses + 1, streak = 0, checks = ' ' WHERE user_id = '${id}';`);
                    resStr = `@${id}: You guessed ${guess}. The word was ${user.word.toUpperCase()}. You have no more guesses. Type !wordle to play again!`;

                }
            }
        }

        // Release the client.
        client.release();
        
        // Return response.
        return (resStr);
        
    } catch (err) {
        console.log(err);
        return;
    }
};


// Function to reset the Wordle for this user. This counts as a loss and breaks their streak.
async function wordleSux(id) {
    try {

        // Update the database.
        let client = await pool.connect();
        await client.query(`UPDATE wordle SET word = ' ', remain = 6, guess = ' ', losses = losses + 1, streak = 0, checks = ' ' WHERE user_id = '${id}';`);
        client.release();

        // Return confirmation to the user.
        return(`@${id}: Your Wordle has been reset.`);

    } catch (err) {
        console.log(err);
        return;
    }
};


// Function to get the previous Wordle guesses for this user and each guess's accuracy.
async function wordleGuesses(id) {
    try {

        // Pull this user from the Wordle database.
        let client = await pool.connect();
        let res = await client.query(`SELECT * FROM wordle WHERE user_id = '${id}';`);
        let user = res.rows[0];
        client.release();
    
        if (!user || user.word === ' ') {

            // User does not currently have a word.
            return `@${id}: You do not currently have a word! Type !wordle to start!`;

        } else if (user.remain == 6) {

            // User has not many any guesses.
            return `@${id}: You have not made any guesses yet!`;

        } else {

            // Declare array of past guesses and their accuracy.
            let past = [];

            // Loop through past guesses.
            for (let k = 0; k < (user.guess.length - 1) / 5; k++) {

                // Select guess number k.
                let guess = user.guess.substring((k * 5) + 1, (k * 5) + 6);

                // Check the accuracy of the guess.
                let accuracy = check(user.word, guess);

                // Push that guess and its accuracy into the array.
                past.push(`${guess} ${accuracy.result}`);

            }
        
            // Return guesses and their accuracy. 
            return `@${id}: Your past guesses: ${past.join(' | ')}`;

        }
    } catch (err) {
        console.log(err);
        return;
    }
};


// Function to get the Wordle stats for a user.
async function wordleStats(id) {
    try {
    
        // Pull this user from the Wordle database.
        let client = await pool.connect();
        let res = await client.query(`SELECT * FROM wordle WHERE user_id = '${id}';`);
        let user = res.rows[0];
        client.release();
    
        if (!user) {

            // This user is not in the Wordle database.
            return `@${id}: You have not played Wordle yet!`;

        } else {

            // Return stats for this user.
            return `Wordle Stats for ${id} | Wins: ${user.wins} | Losses: ${user.losses} | Quickest Guess: ${user.best == 6?'-':user.best} | Longest Streak: ${user.longest}`;

        }
    } catch (err) {
        console.log(err);
        return;
    }
};


// Function to get the Wordle users with the most wins, fastest guess, and longest streak.
async function wordleLb() {
    try {

        // Pull this user from the Wordle database.
        let client = await pool.connect();
        let res = await client.query(`((SELECT * FROM wordle WHERE best = (SELECT MIN(best) FROM wordle) ORDER BY wins DESC LIMIT 1) UNION ALL (SELECT * FROM wordle WHERE wins = (SELECT MAX(wins) FROM wordle) LIMIT 1) UNION ALL (SELECT * FROM wordle WHERE longest = (SELECT MAX(longest) FROM wordle) LIMIT 1)) ORDER BY best ASC, wins ASC, longest ASC;`);
        let top = res.rows;
        client.release();
    
        if (top.length == 1) {

            // This user has the best of all 3 categories.
            top.push(top[0]);
            top.push(top[0]);


        } else if (top.length == 2) {

            // One of these users has the best of 2 categories.
            if (top[0].wins > top[1].wins) {
                top.push(top[1]);
                top[1] = top[0];
            } else {
                top.push(top[0]);
            }

        }
    
        // Return formatted string.
        return `Wordle Leaderboard | Fastest Guess: ${top[0].best==6?'-':(top[0].user_id + ' (' + (top[0].best) + ' guess' + (top[0].best==1?')':'es)'))} ) | Most Wins: ${top[1].user_id} (${top[1].wins}) | Longest Win Streak: ${top[2].user_id} (${top[2].longest})`;

    } catch (err) {
        console.log(err);
        return;
    }
};


// Export the main functions.
export { wordleStart, wordleGuess, wordleSux, wordleGuesses, wordleStats, wordleLb };